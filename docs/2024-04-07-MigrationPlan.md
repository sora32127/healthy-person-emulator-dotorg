# 目的
- 既存のWordpressサイトを新基盤にスムーズに移行すること

# 移行対象
- 既存のWordpressサイト
- Twitter更新通知Bot
- データ分析基盤については今回の移行対象外とする

# やること

## ユーザー向け通知
- 通知することは以下の通り
  - 既存サイトを一時的に閉鎖すること
  - 記事リンクはそのまま活きること
  - 技術的な理由から認証情報を移行できず、編集を行うには再登録が必要になること
- 閉鎖期間としては最長24時間を予定している
  - 場合によっては延長する必要があるかもしれない

## 既存Wordpressサイトの閉鎖
- 投稿フォームの閉鎖も同時に行う
- 実際の動作は以下の通り
  - LightSailのコンソールからインスタンスを停止する
  - CloudflareのコンソールからPagesを削除する

## ドメインのVercelへの移行
- Vercelのコンソールからドメインを追加する
- CloudflareのコンソールからDNSの設定を変更する
- [参考](https://zenn.dev/keitakn/articles/add-cloudflare-domain-to-vercel)

## データ移行
- プレ移行 04/08
  - 移行のチュートリアルが目的
  - 既存WordpressサイトのデータをSupabaseに移管する
  - 既存Supabaseのデータを一度すべてTruncateする
  - 既存WordpressサイトのデータをSupabaseに移行する
    - wp_**テーブルからINSERT文でデータを移行する
    - likebtnデータのみCSV形式で移行する
    - この際に利用したINSERT文を残しておく
- 本移行 04/09
  - サイトを閉鎖したうえでの実行

### 移行プロセス詳細
- 既存データをSupabase内部に移動
- 既存データを一度すべてTruncateする
- bitnami_wordpressスキーマのデータをpublicスキーマに移行する

#### 既存データのSupabaseへの移行
- [Supabase移行用Google Colab](https://colab.research.google.com/github/mansueli/Supa-Migrate/blob/main/Amazon_RDS_to_Supabase.ipynb#scrollTo=76XQI9t3q6ut)を利用する
  - 移行用Google ColabのSet the environment variables設定を行う
  - 移行には時間がかかるので、並行してlikebtnデータの移行を実施
- [likebtnデータの移行](https://healthy-person-emulator.org/wp-admin/admin.php?page=likebtn_votes)
  - Export to CSVをクリックしてCSVファイルをダウンロードする
    - Encoding, Field SeparatorはUTF-8, カンマに設定する
    - 5.2MB程度のファイルになる想定
- SupabaseのTable Editor画面でbitnami_wordpressスキーマに移動
  - likebtn_votesテーブルを作成する
    - テーブル名はfct_post_vote_history
    - 作成後、プライマリーキーとしてpost_vote_idを追加する

#### 既存データのTruncate
- 外部キー制約を利用し、以下の順番でTruncateを実行する
```sql
BEGIN;

TRUNCATE TABLE fct_comment_vote_history CASCADE;
TRUNCATE TABLE fct_post_vote_history CASCADE;
TRUNCATE TABLE fct_post_edit_history CASCADE;
TRUNCATE TABLE rel_post_tags CASCADE;
TRUNCATE TABLE now_editing_pages CASCADE;
TRUNCATE TABLE dim_comments CASCADE;
TRUNCATE TABLE dim_posts CASCADE;
TRUNCATE TABLE dim_tags CASCADE;

COMMIT;
```

#### bitnami_wordpressスキーマからpublicスキーマへのデータ移行
- dim_tags
  ```sql
  insert into dim_tags (tag_id, tag_name)
  select
    term_id as tag_id,
    name as tag_name
  from bitnami_wordpress.wp_terms;
  ```
- dim_posts
  ```sql
  begin;
  insert into dim_posts (post_id, post_date_jst, post_date_gmt, post_content, post_title, comment_status, count_likes, count_dislikes, post_author_ip_hash)
  select
    id as post_id,
    post_date as post_date_jst,
    post_date_gmt,
    post_content,
    post_title,
    comment_status,
    0 as count_likes,
    0 as count_dislikes,
    post_author as post_author_ip_hash
  from bitnami_wordpress.wp_posts
  where
    post_status = 'publish'
    and post_type = 'post';

  UPDATE public.dim_posts dp
  SET
    count_likes = COALESCE((
      SELECT CAST(wpm_likes.meta_value AS INTEGER)
      FROM bitnami_wordpress.wp_postmeta wpm_likes
      WHERE wpm_likes.post_id = CAST(dp.post_id AS NUMERIC) AND wpm_likes.meta_key = 'Likes'
    ), 0),
    count_dislikes = COALESCE((
      SELECT CAST(wpm_dislikes.meta_value AS INTEGER)
      FROM bitnami_wordpress.wp_postmeta wpm_dislikes
      WHERE wpm_dislikes.post_id = CAST(dp.post_id AS NUMERIC) AND wpm_dislikes.meta_key = 'Dislikes'
    ), 0);

  commit;
  ```
- dim_comments
  ```sql
  begin;

  delete from bitnami_wordpress.wp_comments
  where comment_post_id not in (select post_id from dim_posts);

  insert into dim_comments (comment_id, post_id, comment_author, comment_author_ip_hash, comment_date_jst, comment_date_gmt, comment_content, comment_parent)
    select
      comment_id,
      comment_post_id as post_id,
      comment_author,
      comment_author_ip as comment_author_ip_hash,
      comment_date as comment_date_jst,
      comment_date_gmt,
      comment_content,
      comment_parent
  from bitnami_wordpress.wp_comments;

  commit;
  
  ```
- rel_post_tags
  ```sql
  begin;

  delete from bitnami_wordpress.wp_term_relationships
  where object_id not in (select post_id from dim_posts);

  insert into rel_post_tags (post_id, tag_id)
  select
    object_id as post_id,
    term_taxonomy_id as tag_id
  from bitnami_wordpress.wp_term_relationships;

  commit;
  ```
- fct_post_vote_history
  ```sql
  begin;

  delete from bitnami_wordpress.fct_post_vote_history
  where "Item ID" not in (select post_id from dim_posts);

  insert into public.fct_post_vote_history (vote_date_gmt, vote_user_ip_hash, post_id, vote_type_int, vote_date_jst, post_vote_id)
  select
    "Date" as vote_date_gmt,
    "IP" as vote_user_ip_hash,
    "Item ID" as post_id,
    case
      when "Vote type" = 'dislike' then -1
      when "Vote type" = 'like' then 1
      else null 
    end as vote_type_int,
    "Date" as vote_date_jst,
    post_vote_id
  from bitnami_wordpress.fct_post_vote_history;

  commit;
  
  ```
- fct_comment_vote_history
  ```sql
  begin;

  delete from bitnami_wordpress.wp_wc_users_voted
  where comment_id not in (select comment_id from dim_comments);

  delete from bitnami_wordpress.wp_wc_users_voted
  where post_id not in (select post_id from dim_posts);

  insert into fct_comment_vote_history (comment_id, vote_type, post_id, vote_user_ip_hash, comment_vote_date_jst, comment_vote_date_utc)
  select
    comment_id,
    vote_type,
    post_id,
    user_id as vote_user_ip_hash,
    to_timestamp(date) as comment_vote_date_jst,
    to_timestamp(date) as comment_vote_date_utc
  from bitnami_wordpress.wp_wc_users_voted;

  commit;
  
  ```

## Twitter更新通知Botの取得元変更
- あとは`sls deploy --stage prod`を実行するだけ

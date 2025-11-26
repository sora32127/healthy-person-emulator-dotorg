import type { MetaFunction } from '@remix-run/node';
import { H1 } from '~/components/Headings';
import { commonMetaFunction } from '~/utils/commonMetafunction';

export default function CommerceDisclosure() {
  return (
    <div className="templateSubmitForm">
      <H1>特定商取引法に基づく表記</H1>
      <table className="w-full border-collapse">
        <tbody>
          <tr className="border-b">
            <th className="p-4 text-left">販売業社の名称・サイト管理代表者</th>
            <td className="p-4">上村空知</td>
          </tr>
          <tr className="border-b">
            <th className="p-4 text-left">所在地</th>
            <td className="p-4">請求があったら遅滞なく開示します</td>
          </tr>
          <tr className="border-b">
            <th className="p-4 text-left">電話番号</th>
            <td className="p-4">請求があったら遅滞なく開示します</td>
          </tr>
          <tr className="border-b">
            <th className="p-4 text-left">メールアドレス</th>
            <td className="p-4">sora32127@gmail.com</td>
          </tr>
          <tr className="border-b">
            <th className="p-4 text-left">販売価格と手数料</th>
            <td className="p-4">各商品ページに記載の金額となります</td>
          </tr>
          <tr className="border-b">
            <th className="p-4 text-left">返金ポリシー</th>
            <td className="p-4">商品の性質上、返金は受け付けかねます</td>
          </tr>
          <tr className="border-b">
            <th className="p-4 text-left">提供時期</th>
            <td className="p-4">注文後すぐにご利用いただけます</td>
          </tr>
          <tr className="border-b">
            <th className="p-4 text-left">受け付け可能な決済手段</th>
            <td className="p-4">クレジットカード</td>
          </tr>
          <tr className="border-b">
            <th className="p-4 text-left">決済期間</th>
            <td className="p-4">直ちに処理されます</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const meta: MetaFunction = () => {
  const commonMeta = commonMetaFunction({
    title: '特定商取引法に基づく表記',
    description: '特定商取引法に基づく表記について',
    url: 'https://healthy-person-emulator.org/commerceDisclosure',
    image: null,
  });
  return commonMeta;
};

import { Hono } from 'hono';
import { html } from 'hono/html';


const app = new Hono();

async function getAllTags(AUTH_STRING:string): Promise<any[]> {
  let page = 1;
  let tags: any[] = [];

  while (true) {
    const response = await fetch(
      `https://healthy-person-emulator.org/wp-json/wp/v2/tags?page=${page}&per_page=100`,
      {
        headers: {
          'Authorization': AUTH_STRING
        }
      }
    );
    const data = await response.json();
    if (data.length === 0) {
      break;
    }

    tags = tags.concat(data);
    page++;
  }

  return tags;
}

app.all('/maketext', async (c) => {
  console.log('投稿内容:', c.req.json());
  const {
    situationValues = {},
    assumptionValues = [],
    reflectionValues = [],
    counterReflectionValues = [],
    noteValues = [],
    titleValues = [],
    selectedType = '',
    selectedTags = [],
  } = await c.req.json();

  const AUTH_STRING = 'Basic ' + btoa(`${c.env.WP_USER_NAME}:${c.env.WP_USER_PASS}`);


  const result = html`
    <h3>5W1H+Then状況説明</h3>
    <table><tbody>
      <tr><td>Who(誰が)</td><td>${situationValues.who}</td></tr>
      <tr><td>When(いつ)</td><td>${situationValues.when}</td></tr>
      <tr><td>Where(どこで)</td><td>${situationValues.where}</td></tr>
      <tr><td>Why(なぜ)</td><td>${situationValues.why}</td></tr>
      <tr><td>What(何を)</td><td>${situationValues.what}</td></tr>
      <tr><td>How(どのように)</td><td>${situationValues.how}</td></tr>
      <tr><td>Then(どうした)</td><td>${situationValues.then}</td></tr>
    </tbody></table>
    <h3>前提条件</h3>
    <ul>
      ${assumptionValues.map((assumption) => html`<li>${assumption}</li>`)}
    </ul>
    <h3>
      ${selectedType == 'misDeed'
        ? '健常行動ブレイクポイント'
        : selectedType == 'goodDeed'
        ? 'なぜやってよかったのか'
        : ''}
    </h3>
    <ul>
      ${reflectionValues.map((reflection) => html`<li>${reflection}</li>`)}
    </ul>

    <h3>
      ${selectedType == 'misDeed'
        ? 'どうすればよかったか'
        : selectedType == 'goodDeed'
        ? 'やらなかったらどうなっていたか'
        : ''}
    </h3>
    <ul>
      ${counterReflectionValues.map((counterReflection) => html`<li>${counterReflection}</li>`)}
    </ul>

    <h3>備考</h3>
    <ul>
      ${noteValues.map((note) => html`<li>${note}</li>`)}
    </ul>

    <h1>タイトル</h1>
    <p>${titleValues[0]}</p>

    <h1>タグ</h1>
    <p>
      ${selectedTags.map((tag) => `#${tag}`).join(' ')}
    </p>
  `;

  const htmlText = c.html(result);

  const allTags = await getAllTags(AUTH_STRING);
  const existingTagNames = allTags.map((tag) => tag.name);

  let tag_id_list: number[] = [];
  for (let i = 0; i < selectedTags.length; i++) {
    let tag_id: number;

    const tagIndex = existingTagNames.indexOf(selectedTags[i]);
    if (tagIndex !== -1) {
      tag_id = allTags[tagIndex].id;
    } else {
      try {
        const response = await fetch(
          'https://healthy-person-emulator.org/wp-json/wp/v2/tags',
          {
            'method': 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': AUTH_STRING
            },
            body: JSON.stringify({
              'name': selectedTags[i],
            })
          }
        );
        const data = await response.json();
        tag_id = data.id;
      } catch (error) {
        console.log(error);
        continue;
      }
    }

    tag_id_list.push(tag_id);
  }

  const response = await fetch(
    'https://healthy-person-emulator.org/wp-json/wp/v2/posts',
    {
      "method": "POST",
      "headers": {
        'Content-Type': 'application/json',
        'Authorization': AUTH_STRING
      },
      body: JSON.stringify({
        'title': titleValues[0],
        'content': htmlText,
        'status': 'publish',
        'tags': tag_id_list
      })
    },

  );
  const data = await response.json();
  let postedURL = data.guid.rendered;
  
  // postedURLを返す
  // リダイレクト操作はフロントエンドで行う

  return c.json({ url: postedURL, statuscode: response.status });
}
);
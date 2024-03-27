function removeEmptyString(array: string[]): string[] {
  return array.filter((value) => !/^\s*$/.test(value));
}

export async function onRequest(c) {
    let {
        assumptionValues = [],
        reflectionValues = [],
        counterFactualReflectionValues = [],
        noteValues = [],
        ...rest
      } = await c.request.json();

    const {
        situationValues = {},
        titleValues = [],
        selectedType = '',
        allLabeledTags = [],
      } = rest;
    
    assumptionValues = removeEmptyString(assumptionValues);
    reflectionValues = removeEmptyString(reflectionValues);
    counterFactualReflectionValues = removeEmptyString(counterFactualReflectionValues);
    noteValues = removeEmptyString(noteValues);

    const WP_USER_NAME = c.env.VITE_WP_USER_NAME;
    const WP_USER_PASS = c.env.VITE_WP_USER_PASS;
    const AUTH_STRING = 'Basic ' + btoa(`${WP_USER_NAME}:${WP_USER_PASS}`);
    const result = `
        <h3>5W1H+Then状況説明</h3>
        <table><tbody>
          <tr><td>Who(誰が)</td><td>${situationValues.who || ''}</td></tr>
          <tr><td>When(いつ)</td><td>${situationValues.when || ''}</td></tr>
          <tr><td>Where(どこで)</td><td>${situationValues.where || ''}</td></tr>
          <tr><td>Why(なぜ)</td><td>${situationValues.why || ''}</td></tr>
          <tr><td>What(何を)</td><td>${situationValues.what || ''}</td></tr>
          <tr><td>How(どのように)</td><td>${situationValues.how || ''}</td></tr>
          <tr><td>Then(どうした)</td><td>${situationValues.then || ''}</td></tr>
        </tbody></table>
        ${assumptionValues.length > 0 ? `
          <h3>前提条件</h3>
          <ul>
            ${assumptionValues.map((assumption) => `<li>${assumption}</li>`).join('')}
          </ul>
        ` : ''}
        <h3>
          ${selectedType == 'misDeed'
            ? '健常行動ブレイクポイント'
            : selectedType == 'goodDeed'
            ? 'なぜやってよかったのか'
            : ''}
        </h3>
        <ul>
          ${reflectionValues.map((reflection) => `<li>${reflection}</li>`).join('')}
        </ul>

        <h3>
          ${selectedType == 'misDeed'
            ? 'どうすればよかったか'
            : selectedType == 'goodDeed'
            ? 'やらなかったらどうなっていたか'
            : ''}
        </h3>
        <ul>
          ${counterFactualReflectionValues.map((counterReflection) => `<li>${counterReflection}</li>`).join('')}
        </ul>

        ${noteValues.length > 0 ? `
          <h3>備考</h3>
          <ul>
            ${noteValues.map((note) => `<li>${note}</li>`).join('')}
          </ul>
        ` : ''}
      `;

    const allTags = await getAllTags(AUTH_STRING);
    const existingTagNames = allTags.map((tag) => tag.name);

    const tag_id_list: number[] = [];
    for (let i = 0; i < allLabeledTags.length; i++) {
      let tag_id: number;

      const tagIndex = existingTagNames.indexOf(allLabeledTags[i]);
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
                'name': allLabeledTags[i],
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
          'content': result,
          'status': 'publish',
          'tags': tag_id_list
        })
      },
    );
    const data = await response.json();
    const postedURL = data.guid.rendered;

    return new Response(JSON.stringify({ url: postedURL, statuscode: response.status }), {
        headers: { 'Content-Type': 'application/json' },
    });
}

async function getAllTags(AUTH_STRING: string): Promise<any[]> {
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
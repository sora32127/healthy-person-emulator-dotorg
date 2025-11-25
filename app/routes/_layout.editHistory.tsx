import { useLoaderData } from '@remix-run/react';
import { H1 } from '~/components/Headings';
import { authenticator } from '~/modules/auth.google.server';
import {
  type MetaFunction,
  redirect,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import { getUserEditHistory } from '~/modules/db.server';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CommonNavLink } from '~/components/CommonNavLink';

type EditHistory = {
  postId: number;
  postRevisionNumber: number;
  postEditDateGmt: Date;
  postEditDateJst: Date;
  postTitleBeforeEdit: string;
  postTitleAfterEdit: string;
  dim_posts: {
    postTitle: string;
  };
};

export async function loader({ request }: LoaderFunctionArgs) {
  const isAuthenticated = await authenticator.isAuthenticated(request);
  if (!isAuthenticated) {
    return redirect('/?referrer=fromBookmark');
  }
  const userEditHistory = await getUserEditHistory(isAuthenticated.userUuid);
  return { userEditHistory };
}

function EditHistoryItem({ editHistory }: { editHistory: EditHistory }) {
  const postUrl = `/archives/${editHistory.postId}`;
  const editDate = format(editHistory.postEditDateJst, 'yyyy年MM月dd日 HH:mm', {
    locale: ja,
  });

  return (
    <li className="border-b border-gray-200 py-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <CommonNavLink to={postUrl}>
            {editHistory.dim_posts.postTitle}
          </CommonNavLink>
        </div>
        <div className="text-sm text-gray-500 ml-1">{editDate}</div>
      </div>
    </li>
  );
}

export default function MyPageLayout() {
  const { userEditHistory } = useLoaderData<typeof loader>();
  return (
    <div className="flex flex-col gap-4">
      <H1>編集履歴</H1>
      {userEditHistory.length > 0 && (
        <div className="flex flex-col gap-4">
          <ul className="divide-y divide-gray-200">
            {userEditHistory.map((editHistory) => (
              <EditHistoryItem
                key={`${editHistory.postId}-${editHistory.postRevisionNumber}`}
                editHistory={editHistory}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export const meta: MetaFunction = () => {
  return [{ title: '編集履歴' }];
};

import type { ActionFunctionArgs } from "react-router";
import { LibraryError, mutateLibrary } from "~/modules/library.server";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
};

export async function action({ request }: ActionFunctionArgs) {
  try {
    return Response.json(await mutateLibrary(request), { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof LibraryError) {
      return Response.json({ success: false, error: error.message }, {
        status: error.status,
        headers: PRIVATE_HEADERS,
      });
    }
    console.error("Library request failed");
    return Response.json(
      { success: false, error: "処理に失敗しました。再度お試しください" },
      {
        status: 500,
        headers: PRIVATE_HEADERS,
      },
    );
  }
}

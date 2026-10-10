import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getLibraryEntry, LibraryError, mutateLibrary } from "~/modules/library.server";

const PRIVATE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
};

async function respond(operation: () => Promise<unknown>) {
  try {
    return new Response(JSON.stringify(await operation()), { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof LibraryError) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: error.status,
        headers: PRIVATE_HEADERS,
      });
    }
    console.error("Admin library request failed");
    return new Response(
      JSON.stringify({ success: false, error: "処理に失敗しました。再度お試しください" }),
      {
        status: 500,
        headers: PRIVATE_HEADERS,
      },
    );
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  return respond(async () => {
    const result = await getLibraryEntry(
      request,
      new URL(request.url).searchParams.get("postId") ?? "",
    );
    return { success: true, ...result };
  });
}

export async function action({ request }: ActionFunctionArgs) {
  return respond(() => mutateLibrary(request));
}

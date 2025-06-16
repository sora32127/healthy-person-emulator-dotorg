import { useLoaderData } from "@remix-run/react";

export async function loader() {
    const { searchURL, tagsURL } = getObjectUrls();
    return {
        searchURL,
        tagsURL,
    }
}

export default function Search2() {
    const { searchURL, tagsURL } = useLoaderData<typeof loader>();
    return <div>
        <h1>Search2</h1>
        <p>{searchURL}</p>
        <p>{tagsURL}</p>
    </div>;
}

function getObjectUrls(): {
    searchURL: string;
    tagsURL: string;
} {
    const searchURL = process.env.SEARCH_PARQUET_FILE_PATH
    const tagsURL = process.env.TAGS_PARQEST_FILE_PATH
    if (!searchURL || !tagsURL) {
        throw new Error("SEARCH_PARQUET_URL or TAGS_PARQUET_URL is not set");
    }
    return {
        searchURL,
        tagsURL,
    }
}
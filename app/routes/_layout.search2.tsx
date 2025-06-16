import { useFetcher, useLoaderData } from "@remix-run/react";
import useSWR from 'swr'

export async function loader() {
    const { searchURL, tagsURL } = getObjectUrls();
    return {
        searchURL,
        tagsURL,
    }
}

export default function Search2() {
    const { searchURL, tagsURL } = useLoaderData<typeof loader>();
    const { data: searchData, error: searchError, isLoading: searchLoading } = useDownloadFile(searchURL);
    const { data: tagsData, error: tagsError, isLoading: tagsLoading } = useDownloadFile(tagsURL);
    return <div>
        {searchLoading && <div>Loading...</div>}
        {searchError && <div>Error: {searchError.message}</div>}
        {tagsLoading && <div>Loading...</div>}
        {tagsError && <div>Error: {tagsError.message}</div>}
    </div>;
}

function useDownloadFile(url:string) {
    const fetcher = (url: string) => fetch(url).then(res => res.blob());
    const { data, error, isLoading } = useSWR(url, fetcher);
    return { data, error, isLoading };
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

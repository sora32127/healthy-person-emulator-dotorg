import { useAtomValue } from "jotai";
import { useLoaderData } from "@remix-run/react";

export async function loader() {
    const searchAssetURL = process.env.SEARCH_PARQUET_FILE_PATH

    return {
        searchAssetURL,
    };
}

export default function LightSearch() {
    const { searchAssetURL } = useLoaderData<typeof loader>();
    if (!searchAssetURL) {
        throw new Error("Search asset URL is not set");
    }
    const arrayBuffer = fetchData(searchAssetURL);
    console.log(arrayBuffer);

    return (
        <div>
            <h1>Light Search</h1>
            <input type="text"></input>
        </div>
    );
}

async function fetchData(url: string) {
    const res = await fetch(url);
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return arrayBuffer;
}
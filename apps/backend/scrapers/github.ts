import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

export async function scrapeGithub(username: string) {
    const config: Parameters<typeof axios.request>[0] = {
        url: `https://api.github.com/users/${username}/repos`,
        headers: {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    };

    // Only attach the proxy agent if a PROXY_URL env var is set
    if (process.env.PROXY_URL) {
        config.httpsAgent = new HttpsProxyAgent(process.env.PROXY_URL);
    }

    const userRepos = await axios.request(config);
    return (userRepos.data as any[]).map((x) => ({
        description: x.description,
        name: x.name,
        fullName: x.full_name,
        starCount: x.stargazers_count,
    }));
}

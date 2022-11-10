import fetch from "node-fetch";

const jsonDate = new Date().toJSON();
const owner = "4-point-0";
const repoName = "dev3-contracts";
const manifestFileName = "manifest.json";
const infoFileName = "info.md";
const githubGraphQlApi = "https://api.github.com/graphql";
const githubApi = `https://api.github.com/repos/${owner}/${repoName}/contents`;
const githubRepoUrl = `https://github.com/${owner}/${repoName}/tree/main/`;
const query = `
query{
  repository(owner: "${owner}", name: "${repoName}") {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 1 until: "${jsonDate}") {
            nodes {
              tree {
                entries {
                  name
                  object {
                    ... on Tree {
                      entries {
                        name
                        object{
                          ...on Tree{
                            entries{
                              name
                              object{
                                ...on Tree{
                                  entries{
                                    name
                                  }                                  
                                }
                              }
                            }   
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

try {
  const response = await fetch(githubGraphQlApi, {
    method: "POST",
    body: JSON.stringify({ query }),
    headers: {
      Authorization: `Bearer ${process.env.TOKEN}`,
    },
  });

  const { data } = await response.json();
  const contracts = [];
  for (const node of data.repository.defaultBranchRef.target.history.nodes) {
    for (const treeEntry of node.tree.entries) {
      if (treeEntry.object && treeEntry.object.entries) {
        for (const entry of treeEntry.object.entries) {
          if (entry.object && entry.object.entries) {
            for (const subEntry of entry.object.entries) {
              if (subEntry.object && subEntry.object.entries) {
                for (const subSubEntry of subEntry.object.entries) {
                  if (treeEntry.name && entry.name && subSubEntry.name) {
                    const tokenInfoResp = await fetch(
                      `${githubApi}/${treeEntry.name}/${entry.name}/${subEntry.name}/${manifestFileName}`,
                      {
                        method: "GET",
                        headers: {
                          Authorization: `Bearer ${process.env.TOKEN}`,
                        },
                      }
                    );

                    const tokenInfoResult = await tokenInfoResp.json();

                    const { download_url } = tokenInfoResult;

                    const manifestJsonResp = await fetch(download_url, {
                      method: "GET",
                      headers: {
                        Authorization: `Bearer ${process.env.TOKEN}`,
                      },
                    });

                    const manifestJsonResult = await manifestJsonResp.json();

                    const markdownInfoResp = await fetch(
                      `${githubApi}/${treeEntry.name}/${entry.name}/${subEntry.name}/${infoFileName}`,
                      {
                        method: "GET",
                        headers: {
                          Authorization: `Bearer ${process.env.TOKEN}`,
                        },
                      }
                    );

                    const markdownInfoResult = await markdownInfoResp.json();
                    contracts.push({
                      name: manifestJsonResult.name,
                      description: manifestJsonResult.description,
                      tags: manifestJsonResult.tags,
                      creator_name: entry.name,
                      github_url: `${githubRepoUrl}/tree/main/${tokenInfoResult.path}`,
                      info_markdown_url: markdownInfoResult.download_url,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const res = await fetch(process.env.CONTRACTS_API_URL, {
    method: "POST",
    body: JSON.stringify(contracts),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.UPDATE_CONTRACTS_SECRET}`,
    },
  });
  console.log(res);
} catch (err) {
  console.log(err);
}

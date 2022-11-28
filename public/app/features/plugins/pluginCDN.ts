// ⚠️ POC plugin CDN stuffs! ⚠️
const cdnHost = 'https://plugin-cdn.storage.googleapis.com';

function extractPluginDeets(address: string) {
  const match = /public\/plugin-cdn\/(.+)\/(.+)\/module\.js/i.exec(address);
  if (!match) {
    return;
  }
  const [_, name, version] = match;
  return { name, version };
}

export function locateFromCDN(load: { address: string }): string {
  const { address } = load;
  // http://localhost:3000/public/plugin-cdn/pluginID/version/module
  const pluginPath = address.split('/public/plugin-cdn/');
  // https://plugin-cdn.storage.googleapis.com/pluginID/version/module
  return `${cdnHost}/${pluginPath[1]}`;
}

export function translateForCDN(load: any): string {
  const { address, name, source } = load;
  const deets = extractPluginDeets(address);
  console.log('--------------------- translateForCDN ------------------------');
  console.log({ load });
  console.log('^^ ---------------------');

  // Change paths into something that a CDN can work with?
  // public/plugins/ -> `${cdnHost}/${deets.name}/${deets.version}/${deets.name}`

  return load;
}

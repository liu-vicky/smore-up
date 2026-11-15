import {readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync} from 'node:fs';
import path from 'node:path';

const assets = {};
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
};

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const filePath = path.join(dir, name);

    if (statSync(filePath).isDirectory()) {
      walk(filePath);
      continue;
    }

    const type = types[path.extname(name)];
    if (!type) continue;

    const assetPath = '/' + path.relative('web', filePath).split(path.sep).join('/');
    assets[assetPath] = {
      type,
      body: readFileSync(filePath).toString('base64'),
    };
  }
}

function formatAssets(assetMap) {
  const entries = Object.entries(assetMap).map(([assetPath, asset]) => {
    const bodyChunks = asset.body.match(/.{1,100}/g) || [''];
    const formattedBody = bodyChunks
      .map(chunk => `        ${JSON.stringify(chunk)}`)
      .join(',\n');

    return `  ${JSON.stringify(assetPath)}: {\n` +
      `    type: ${JSON.stringify(asset.type)},\n` +
      '    body: [\n' +
      `${formattedBody}\n` +
      '    ].join(""),\n' +
      '  },';
  });

  return `const ASSETS = {\n${entries.join('\n')}\n};\n\n`;
}

walk('web');

rmSync('dist', {recursive: true, force: true});
mkdirSync('dist/server', {recursive: true});

const bundle = formatAssets(assets) + readFileSync('worker/index.js', 'utf8');
writeFileSync('dist/server/index.js', bundle);
console.log(`Built Worker with ${Object.keys(assets).length} embedded assets (${bundle.length} bytes)`);

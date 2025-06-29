import envPlugin from '@intrnl/esbuild-plugin-env';
import { build } from 'esbuild';

const outfile = process.argv[2] ?? 'build/build.js';

function buildProject() {
  return build({
    entryPoints: ['index.js'],
    outfile,
    bundle: true,
    sourcemap: true,
    target: 'es2024',
    plugins: [envPlugin()]
  });
}

buildProject().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});

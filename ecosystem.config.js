module.exports = [
  {
    script: 'dist/src/main.js',
    name: 'back',
    exec_mode: 'cluster',
    instances: 1,
    node_args: '--max-old-space-size=8000 --expose_gc',
  },
];

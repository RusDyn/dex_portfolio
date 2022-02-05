const address = (process.env.DEFAULT_ADDRESS || '').toLowerCase();

const addresses = {
  [address]: 'wallet',
  '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619': 'WETH',
  '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 'USDC',
  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 'USDT',
  '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270': 'WMATIC',
};

export function parseAddress(a: string) {
  const a2 = a.toLowerCase();
  if (!(a2 in addresses)) {
    return a2;
  }
  return addresses[a2];
}

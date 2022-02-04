const address = (process.env.DEFAULT_ADDRESS || '').toLowerCase();

const addresses = {
  [address]: 'wallet',
  '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619': 'WETH',
};

export function parseAddress(a: string) {
  const a2 = a.toLowerCase();
  if (!(a2 in addresses)) {
    return a2;
  }
  return addresses[a2];
}

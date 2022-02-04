import Moralis from 'moralis/node';
import { BigNumber, ethers } from 'ethers';

import { getPrices } from './prices';
import { parseAddress } from './addresses';

async function getTokenTransfers(address: string) {
  const transfers = await Moralis.Web3API.account.getTokenTransfers({
    chain: process.env.MORALIS_CHAIN as any,
    address,
  });
  const items: any = {};
  const itemsTimes: any = {};

  const resultItems = transfers.result || [];
  for (const resultItem of resultItems) {
    const {
      transaction_hash,
      address: contract,
      to_address,
      from_address,
      block_timestamp,
      value,
    } = resultItem;

    const t = items[transaction_hash] || [];
    t.push([contract, from_address, to_address, BigNumber.from(value)]);
    itemsTimes[transaction_hash] = block_timestamp;
    items[transaction_hash] = t;
  }

  const keys = Object.keys(items);
  const result: Array<{ date: number; change: any }> = [];
  for (const key of keys) {
    const item = items[key];
    const time = itemsTimes[key];

    const combinedItem: { [address: string]: BigNumber } = {};
    for (const item2 of item) {
      const [contract, from, to, value] = item2;
      let newValue: BigNumber = combinedItem[contract] || BigNumber.from(0);
      if (from.toLowerCase() === address.toLowerCase()) {
        newValue = newValue.sub(value);
      }
      if (to.toLowerCase() === address.toLowerCase()) {
        newValue = newValue.add(value);
      }
      combinedItem[contract] = newValue;
    }

    result.push({ date: new Date(time).getTime(), change: combinedItem });
  }
  return result.sort((a, b) => a.date - b.date);
}

function logBalances(balances: { [address: string]: BigNumber }) {
  const item = Object.keys(balances)
    .map((key) => `${parseAddress(key)}: ${balances[key].toString()}`)
    .join('\n');
  console.log(item);
}

export async function moralisTest() {
  Moralis.Web3API.initialize({ apiKey: process.env.MORALIS_API_KEY });

  const tokenBalancesResult = await Moralis.Web3API.account.getTokenBalances({
    address: process.env.DEFAULT_ADDRESS || '',
    chain: process.env.MORALIS_CHAIN as any,
  });
  const balances: { [address: string]: BigNumber } = {};
  for (const item of tokenBalancesResult) {
    const { token_address, balance } = item;
    balances[token_address] = BigNumber.from(balance);
  }

  logBalances(balances);

  const transfers = await getTokenTransfers(process.env.DEFAULT_ADDRESS || '');

  const prevBalance: { [address: string]: BigNumber } = {};
  let prevBalanceUSD = 0;

  const changes = [];
  for (const transfer of transfers) {
    const { date, change } = transfer;
    const newBalance = await getPrices(prevBalance, date);
    const newBalanceUSD = parseFloat(
      ethers.utils.formatUnits(newBalance, 'ether'),
    );
    const balanceChange = newBalanceUSD - prevBalanceUSD;
    const percentChange =
      prevBalanceUSD != 0 ? balanceChange / prevBalanceUSD : 0;
    console.log(
      `Prev: ${prevBalanceUSD} USD, new: ${newBalanceUSD}, change: ${balanceChange}, ${(
        percentChange * 100
      ).toFixed(2)}%`,
    );

    changes.push(percentChange);

    const keys = Object.keys(change);
    for (const key of keys) {
      const value = change[key];
      const newValue = prevBalance[key] || BigNumber.from(0);
      prevBalance[key] = newValue.add(value);
    }

    console.log(`balance on ${new Date(date)}`);
    logBalances(prevBalance);
    const newBalance2 = await getPrices(prevBalance, date);
    const newBalanceUSD2 = parseFloat(
      ethers.utils.formatUnits(newBalance2, 'ether'),
    );
    prevBalanceUSD = newBalanceUSD2;
  }

  console.log(`Last: ${prevBalanceUSD} USD `);
  console.log(changes.reduce((a, b) => (a + 1) * (b + 1) - 1, 0));
}

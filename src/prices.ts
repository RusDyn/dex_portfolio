import { BigNumber, ethers } from 'ethers';
import Moralis from 'moralis/node';
import { parseAddress } from './addresses';

async function getPrice(address: string, date: string) {
  try {
    const result = await Moralis.Web3API.native.getDateToBlock({ date });
    const price2 = await Moralis.Web3API.token.getTokenPrice({
      chain: process.env.MORALIS_CHAIN as any,
      address,
      to_block: result.block,
    });
    return price2.usdPrice;
  } catch (e) {
    if (
      (e as any).message ==
      'No pools found with enough liquidity, to calculate the price'
    ) {
      return 0;
    }
    console.log(parseAddress(address), date);
    console.log(e);
  }
  return 0;
}

async function getRates(dateString: string, keys: string[]) {
  const result: { [address: string]: number } = {};
  const promises = keys.map(async (key) => {
    const exchangeRate = await getPrice(key, dateString);
    result[key] = exchangeRate;
  });
  await Promise.all(promises);
  return result;
}
export async function getPrices(
  balance: { [address: string]: BigNumber },
  date: number,
) {
  const keys = Object.keys(balance);
  let totalPrice = BigNumber.from(0);
  if (keys.length == 0) {
    return totalPrice;
  }
  const d2 = Math.pow(10, 8);
  const dateString = new Date(date).toISOString();
  const rates = await getRates(dateString, keys);
  for (const key of keys) {
    const value = balance[key];
    const exchangeRate = rates[key];
    if (exchangeRate == 0) {
      continue;
    }

    const exchangeRateBN = ethers.utils.parseUnits(exchangeRate.toFixed(8), 8);
    const changeValue = value.mul(exchangeRateBN).div(d2);
    totalPrice = totalPrice.add(changeValue);
  }
  return totalPrice;
}

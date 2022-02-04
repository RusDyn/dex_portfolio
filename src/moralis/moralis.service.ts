import { Injectable } from '@nestjs/common';
import Moralis from 'moralis/node';
import { BigNumber, ethers } from 'ethers';
import { parseAddress } from '../addresses';
import { Balance, Transfer } from '../types';

@Injectable()
export class MoralisService {
  cache: {
    [key: string]: any;
  } = {};

  constructor() {
    Moralis.Web3API.initialize({ apiKey: process.env.MORALIS_API_KEY });
  }

  static getChain(): 'polygon' {
    return process.env.MORALIS_CHAIN as any;
  }
  async getTokenBalances(address: string) {
    const tokenBalancesResult = await Moralis.Web3API.account.getTokenBalances({
      address,
      chain: MoralisService.getChain(),
    });
    const balances: { [address: string]: BigNumber } = {};
    for (const item of tokenBalancesResult) {
      const { token_address, balance } = item;
      balances[token_address] = BigNumber.from(balance);
    }
    return balances;
  }

  async getTokenTransfers(address: string): Promise<Transfer[]> {
    const transfers = await Moralis.Web3API.account.getTokenTransfers({
      chain: MoralisService.getChain(),
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

  async getPrice(address: string, date: string) {
    const key = `Price:${address}:${date}`; // TODO: redis cache
    if (key in this.cache) {
      return this.cache[key];
    }

    let price = 0;
    try {
      const result = await Moralis.Web3API.native.getDateToBlock({ date });
      const price2 = await Moralis.Web3API.token.getTokenPrice({
        chain: MoralisService.getChain(),
        address,
        to_block: result.block,
      });
      price = price2.usdPrice;
    } catch (e) {
      if (
        (e as any).message ==
        'No pools found with enough liquidity, to calculate the price'
      ) {
        // nothing to do - cache it
      } else {
        // some other error - skip for now
        console.log(parseAddress(address), date);
        console.log(e);
        return 0;
      }
    }

    this.cache[key] = price;
    return price;
  }

  async getRates(dateString: string, keys: string[]) {
    const result: { [address: string]: number } = {};
    const promises = keys.map(async (key) => {
      const exchangeRate = await this.getPrice(key, dateString);
      result[key] = exchangeRate;
    });
    await Promise.all(promises);
    return result;
  }

  async getPrices(balance: Balance, date: number) {
    const keys = Object.keys(balance);
    let totalPrice = BigNumber.from(0);
    if (keys.length == 0) {
      return totalPrice;
    }
    const d2 = Math.pow(10, 8);
    const dateString = new Date(date).toISOString();
    const rates = await this.getRates(dateString, keys);
    for (const key of keys) {
      const value = balance[key];
      const exchangeRate = rates[key];
      if (exchangeRate == 0) {
        continue;
      }

      const exchangeRateBN = ethers.utils.parseUnits(
        exchangeRate.toFixed(8),
        8,
      );
      const changeValue = value.mul(exchangeRateBN).div(d2);
      totalPrice = totalPrice.add(changeValue);
    }
    return totalPrice;
  }
}

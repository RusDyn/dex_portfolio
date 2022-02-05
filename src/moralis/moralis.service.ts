import { Injectable } from '@nestjs/common';
import Moralis from 'moralis/node';
import { BigNumber } from 'ethers';
import { Transfer } from '../types';

@Injectable()
export class MoralisService {
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
    let offset = 0;
    const items: any = {};
    const itemsTimes: any = {};

    while (true) {
      const transfers = await Moralis.Web3API.account.getTokenTransfers({
        chain: MoralisService.getChain(),
        address,
        //limit: 100000,
        offset,
      });

      const resultItems = transfers.result || [];
      if (resultItems.length == 0) {
        break;
      }
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
      offset += resultItems.length;
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
}

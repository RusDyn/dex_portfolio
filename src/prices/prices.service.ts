import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import Moralis from 'moralis/node';
import { parseAddress } from '../addresses';
import { MoralisService } from '../moralis/moralis.service';
import { Balance } from '../types';
import { BigNumber, ethers } from 'ethers';
import { GraphQLClient, gql } from 'graphql-request';

interface PoolToken {
  id: string;
  symbol: string;
  decimals: string;
}

interface TokenInfo {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  volumeUSD: number;
  txCount: number;
}

interface Pool {
  id: string;
  token0: PoolToken;
  token1: PoolToken;
}
@Injectable()
export class PricesService implements OnApplicationBootstrap {
  cache: {
    [key: string]: any;
  } = {};

  dateToBlock: {
    [date: string]: number;
  } = {};

  pools: Pool[] = [];
  tokens: { [id: string]: TokenInfo } = {};
  prices: { [id: string]: { [time: string]: number } } = {};

  async onApplicationBootstrap() {
    await this.loadUniswapTokens();

    const keys = Object.keys(this.tokens);

    const promises = keys.map(async (key) => {
      const item: TokenInfo = this.tokens[key];
      console.log(`Loading prices for ${item.name} ${key}`);
      await this.loadUniswapPrices(key);
    });

    console.log(`Finished loading prices`);
    await Promise.all(promises);
  }

  constructor() {}

  async loadUniswapTokens() {
    const limit = 100; // 1000 loads to long
    const query = gql`
      {
        tokens(first: ${limit}, orderBy: volumeUSD, orderDirection: desc) {
          id
          symbol
          name
          decimals
          txCount
          volumeUSD
        }
      }
    `;

    const result: { [id: string]: TokenInfo } = {};
    const { tokens } = await this.uniswapQuery(query);
    for (const token of tokens) {
      const { decimals, id, name, symbol, volumeUSD, txCount } = token;
      result[id] = {
        id,
        name,
        symbol,
        decimals: parseInt(decimals),
        volumeUSD: parseFloat(volumeUSD),
        txCount: parseInt(txCount),
      };
    }
    this.tokens = result;
  }
  async getUniswapPools() {
    const query = gql`
      {
        pools(first: 1000, orderBy: liquidity, orderDirection: desc) {
          id
          token0 {
            id
            symbol
            decimals
          }
          token1 {
            id
            symbol
            decimals
          }
        }
      }
    `;
    const { pools } = await this.uniswapQuery(query);
    this.pools = pools;
    return pools;
  }
  async uniswapQuery(query: string) {
    const client = new GraphQLClient(
      'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon',
    );
    const data = await client.request(query);
    return data;
  }
  async loadUniswapPrices(address: string) {
    let skip = 0;
    const parsedData: { [time: string]: number } = {};
    while (true) {
      const query = gql`
        {
          tokenHourDatas(
            first: 1000
            skip: ${skip}
            where: { token: "${address}" }
          ) {
            priceUSD
            periodStartUnix
          }
        }
      `;
      const { tokenHourDatas: data } = await this.uniswapQuery(query);
      if (data.length === 0) {
        break;
      }

      for (const item of data) {
        const { priceUSD, periodStartUnix } = item;
        const price = parseFloat(priceUSD);
        if (price == 0) {
          continue;
        }
        const time = periodStartUnix * 1000;
        parsedData[time] = price;
      }
      skip += data.length;
    }
    this.prices[address] = parsedData;
  }
  getPoolId(address: string, address2: string) {
    const result = this.pools.filter(
      (item) => item.token1.id == address2 && item.token0.id == address,
    );
    return result[0].id;
  }

  async getDateToBlock(date: string) {
    if (date in this.dateToBlock) {
      return this.dateToBlock[date];
    }
    const result = await Moralis.Web3API.native.getDateToBlock({ date });
    const { block } = result;
    this.dateToBlock[date] = block;
    return block;
  }

  async getMoralisPrice(address: string, date: Date) {
    const key = `Price:${address}:${date}`; // TODO: redis cache
    if (key in this.cache) {
      return this.cache[key];
    }
    let price = 0;
    try {
      const dateString = date.toISOString();
      const to_block = await this.getDateToBlock(dateString);
      const price2 = await Moralis.Web3API.token.getTokenPrice({
        chain: MoralisService.getChain(),
        address,
        to_block,
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
  async getPrice(address: string, date: Date) {
    if (!(address in this.prices)) {
      return 0;
    }

    const time = date.getTime();

    const prices = this.prices[address];
    const keys = Object.keys(prices).map((item) => parseInt(item));
    if (keys[0] > time) {
      return prices[keys[0]];
    }

    const closest = keys.reduce(function (prev, curr) {
      return Math.abs(curr - time) < Math.abs(prev - time) ? curr : prev;
    });

    return prices[closest];
  }

  async getRates(date: Date, keys: string[]) {
    const result: { [address: string]: number } = {};
    const promises = keys.map(async (key) => {
      const exchangeRate = await this.getPrice(key, date);
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
    const rates = await this.getRates(new Date(date), keys);
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

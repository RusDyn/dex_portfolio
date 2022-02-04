import { Injectable } from '@nestjs/common';
import { BigNumber, ethers } from 'ethers';
import { MoralisService } from './moralis/moralis.service';
import { Balance, Transfer } from './types';
import Moralis from 'moralis';
import transfer = Moralis.transfer;

@Injectable()
export class AppService {
  constructor(private readonly moralis: MoralisService) {}

  getHello(): string {
    return 'Hello World!';
  }

  getPercentChange(prevBalance: number, newBalance: number) {
    const change = newBalance - prevBalance;
    let percentChange = 0;
    if (prevBalance) {
      percentChange = change / prevBalance;
    }
    return percentChange;
  }
  async parseTransfer(
    prevBalance: Balance,
    prevBalanceUSD: number,
    date: number,
    change: Balance,
  ): Promise<[Balance, number, number]> {
    const newBalance = await this.moralis.getPrices(prevBalance, date);
    const newBalanceUSD = parseFloat(
      ethers.utils.formatUnits(newBalance, 'ether'),
    );

    const percentChange = this.getPercentChange(prevBalanceUSD, newBalanceUSD);

    const balance: Balance = Object.assign({}, prevBalance);
    const keys = Object.keys(change);
    for (const key of keys) {
      const value = change[key];
      const newValue = balance[key] || BigNumber.from(0);
      balance[key] = newValue.add(value);
    }

    const newBalance2 = await this.moralis.getPrices(balance, date);
    const newBalanceUSD2 = parseFloat(
      ethers.utils.formatUnits(newBalance2, 'ether'),
    );
    //prevBalanceUSD = newBalanceUSD2;

    return [balance, newBalanceUSD2, percentChange];
  }
  async getHistory(address: string): Promise<any> {
    const transfers = await this.moralis.getTokenTransfers(address);

    let balance: Balance = {};
    let balanceUSD = 0;

    const changes: number[] = [0];
    const dates: number[] = [transfers[0].date - 1];
    const balances: number[] = [0];
    for (const transfer of transfers) {
      const { date, change } = transfer;
      const [newBalance, newBalanceUSD, newChange] = await this.parseTransfer(
        balance,
        balanceUSD,
        date,
        change,
      );

      balanceUSD = newBalanceUSD;
      balance = newBalance;
      changes.push(newChange);
      balances.push(balanceUSD);
      dates.push(date);
    }

    const lastBalance = await this.moralis.getTokenBalances(address);
    const dateNow = Date.now();
    const lastBalance2 = await this.moralis.getPrices(lastBalance, dateNow);
    const lastBalanceUSD = parseFloat(
      ethers.utils.formatUnits(lastBalance2, 'ether'),
    );
    const lastChange = this.getPercentChange(balanceUSD, lastBalanceUSD);
    changes.push(lastChange);
    balances.push(lastBalanceUSD);
    dates.push(dateNow);

    const profit = changes.reduce((a, b) => (a + 1) * (b + 1) - 1, 0);
    return {
      data: {
        balance: lastBalanceUSD,
        profit,
        dates: {
          last: dates[dates.length - 2],
          first: dates[0],
        },
      },
      changes,
      dates,
      balances,
    };
  }
}

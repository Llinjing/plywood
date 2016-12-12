/*
 * Copyright 2016-2016 Imply Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Moment } from 'moment-timezone';
import * as moment from 'moment-timezone';
import { Timezone } from 'chronoshift';
import { r, ExpressionJS, ExpressionValue, Expression, ChainableExpression } from './baseExpression';
import { HasTimezone } from './mixins/hasTimezone';
import { SQLDialect } from '../dialect/baseDialect';
import { PlywoodValue } from '../datatypes/index';
import { immutableEqual } from 'immutable-class';
import { TimezoneExpressionJS, TimezoneExpressionValue } from "./interfaces/interfaces";

interface Parter {
  (d: Moment): number;
}

const PART_TO_FUNCTION: Lookup<Parter> = {
  SECOND_OF_MINUTE: d => d.seconds(),
  SECOND_OF_HOUR: d => d.minutes() * 60 + d.seconds(),
  SECOND_OF_DAY: d => (d.hours() * 60 + d.minutes()) * 60 + d.seconds(),
  SECOND_OF_WEEK: d => ((d.day() * 24) + d.hours() * 60 + d.minutes()) * 60 + d.seconds(),
  SECOND_OF_MONTH: d => (((d.date() - 1) * 24) + d.hours() * 60 + d.minutes()) * 60 + d.seconds(),
  SECOND_OF_YEAR: d => (((d.dayOfYear() - 1) * 24) + d.hours() * 60 + d.minutes()) * 60 + d.seconds(),

  MINUTE_OF_HOUR: d => d.minutes(),
  MINUTE_OF_DAY: d => d.hours() * 60 + d.minutes(),
  MINUTE_OF_WEEK: d => (d.day() * 24) + d.hours() * 60 + d.minutes(),
  MINUTE_OF_MONTH: d => ((d.date() - 1) * 24) + d.hours() * 60 + d.minutes(),
  MINUTE_OF_YEAR: d => ((d.dayOfYear() - 1) * 24) + d.hours() * 60 + d.minutes(),

  HOUR_OF_DAY: d => d.hours(),
  HOUR_OF_WEEK: d => d.day() * 24 + d.hours(),
  HOUR_OF_MONTH: d => (d.date() - 1) * 24 + d.hours(),
  HOUR_OF_YEAR: d => (d.dayOfYear() - 1) * 24 + d.hours(),

  DAY_OF_WEEK: d => d.day() || 7, // fix Sunday [0 -> 7]
  DAY_OF_MONTH: d => d.date(),
  DAY_OF_YEAR: d => d.dayOfYear(),

  WEEK_OF_MONTH: null,
  WEEK_OF_YEAR: null,

  MONTH_OF_YEAR: d => d.month(),
  YEAR: d => d.year(),

  QUARTER: d => d.quarter()
};

const PART_TO_MAX_VALUES: Lookup<number> = {
  SECOND_OF_MINUTE: 61, // Leap seconds
  SECOND_OF_HOUR: 3601,
  SECOND_OF_DAY: 93601,
  SECOND_OF_WEEK: null,
  SECOND_OF_MONTH: null,
  SECOND_OF_YEAR: null,

  MINUTE_OF_HOUR: 60,
  MINUTE_OF_DAY: 26 * 60,
  MINUTE_OF_WEEK: null,
  MINUTE_OF_MONTH: null,
  MINUTE_OF_YEAR: null,

  HOUR_OF_DAY: 26, // Timezones
  HOUR_OF_WEEK: null,
  HOUR_OF_MONTH: null,
  HOUR_OF_YEAR: null,

  DAY_OF_WEEK: 7,
  DAY_OF_MONTH: 31,
  DAY_OF_YEAR: 366,

  WEEK_OF_MONTH: 5,
  WEEK_OF_YEAR: 53,

  MONTH_OF_YEAR: 12,
  YEAR: null
};

export interface TimePartExpressionValue extends TimezoneExpressionValue {
  part: string;
}

export interface TimePartExpressionJS extends TimezoneExpressionJS {
  part: string;
}

export class TimePartExpression extends ChainableExpression implements HasTimezone {
  static op = "TimePart";
  static fromJS(parameters: TimePartExpressionJS): TimePartExpression {
    let value = ChainableExpression.jsToValue(parameters) as TimePartExpressionValue;
    value.part = parameters.part;
    if (parameters.timezone) value.timezone = Timezone.fromJS(parameters.timezone);
    return new TimePartExpression(value);
  }

  public part: string;
  public timezone: Timezone;

  constructor(parameters: TimePartExpressionValue) {
    super(parameters, dummyObject);
    this.part = parameters.part;
    this.timezone = parameters.timezone;
    this._ensureOp("timePart");
    this._checkOperandTypes('TIME');
    if (typeof this.part !== 'string') {
      throw new Error("`part` must be a string");
    }
    this.type = 'NUMBER';
  }

  public valueOf(): TimePartExpressionValue {
    let value = super.valueOf() as TimePartExpressionValue;
    value.part = this.part;
    if (this.timezone) value.timezone = this.timezone;
    return value;
  }

  public toJS(): TimezoneExpressionJS {
    let js = super.toJS() as TimePartExpressionJS;
    js.part = this.part;
    if (this.timezone) js.timezone = this.timezone.toJS();
    return js;
  }

  public equals(other: TimePartExpression): boolean {
    return super.equals(other) &&
      this.part === other.part &&
      immutableEqual(this.timezone, other.timezone);
  }

  protected _toStringParameters(indent?: int): string[] {
    let ret = [this.part];
    if (this.timezone) ret.push(this.timezone.toString());
    return ret;
  }

  protected _calcChainableHelper(operandValue: any): PlywoodValue {
    const { part } = this;
    let parter = PART_TO_FUNCTION[part];
    if (!parter) throw new Error(`unsupported part '${part}'`);

    if (!operandValue) return null;
    operandValue = moment.tz(operandValue, this.getTimezone().toString());
    return parter(operandValue);
  }

  protected _getJSChainableHelper(operandJS: string): string {
    throw new Error("implement me");
  }

  protected _getSQLChainableHelper(dialect: SQLDialect, operandSQL: string): string {
    return dialect.timePartExpression(operandSQL, this.part, this.getTimezone());
  }

  public maxPossibleSplitValues(): number {
    let maxValue = PART_TO_MAX_VALUES[this.part];
    if (!maxValue) return Infinity;
    return maxValue + 1; // +1 for null
  }

  // HasTimezone mixin:
  public getTimezone: () => Timezone;
  public changeTimezone: (timezone: Timezone) => TimePartExpression;
}

Expression.applyMixins(TimePartExpression, [HasTimezone]);
Expression.register(TimePartExpression);

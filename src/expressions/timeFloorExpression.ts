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

import { Timezone, Duration } from 'chronoshift';
import { r, ExpressionJS, ExpressionValue, Expression, ChainableExpression } from './baseExpression';
import { HasTimezone } from './mixins/hasTimezone';
import { SQLDialect } from '../dialect/baseDialect';
import { PlywoodValue } from '../datatypes/index';
import { InExpression } from './inExpression';
import { TimeRange, Set } from '../datatypes/index';
import { OverlapExpression } from './overlapExpression';
import { TimeBucketExpression } from './timeBucketExpression';
import { immutableEqual } from 'immutable-class';
import { DurationedExpressionJS, DurationedExpressionValue } from "./interfaces/interfaces";

export class TimeFloorExpression extends ChainableExpression implements HasTimezone {
  static op = "TimeFloor";
  static fromJS(parameters: DurationedExpressionJS): TimeFloorExpression {
    let value = ChainableExpression.jsToValue(parameters) as DurationedExpressionValue;
    value.duration = Duration.fromJS(parameters.duration);
    if (parameters.timezone) value.timezone = Timezone.fromJS(parameters.timezone);
    return new TimeFloorExpression(value);
  }

  public duration: Duration;
  public timezone: Timezone;

  constructor(parameters: DurationedExpressionValue) {
    super(parameters, dummyObject);
    let duration = parameters.duration;
    this.duration = duration;
    this.timezone = parameters.timezone;
    this._ensureOp("timeFloor");
    this._bumpOperandToTime();
    this._checkOperandTypes('TIME');
    if (!(duration instanceof Duration)) {
      throw new Error("`duration` must be a Duration");
    }
    if (!duration.isFloorable()) {
      throw new Error(`duration '${duration.toString()}' is not floorable`);
    }
    this.type = 'TIME';
  }

  public valueOf(): DurationedExpressionValue {
    let value = super.valueOf() as DurationedExpressionValue;
    value.duration = this.duration;
    if (this.timezone) value.timezone = this.timezone;
    return value;
  }

  public toJS(): DurationedExpressionJS {
    let js = super.toJS() as DurationedExpressionJS;
    js.duration = this.duration.toJS();
    if (this.timezone) js.timezone = this.timezone.toJS();
    return js;
  }

  public equals(other: TimeBucketExpression): boolean {
    return super.equals(other) &&
      this.duration.equals(other.duration) &&
      immutableEqual(this.timezone, other.timezone);
  }

  protected _toStringParameters(indent?: int): string[] {
    let ret = [this.duration.toString()];
    if (this.timezone) ret.push(this.timezone.toString());
    return ret;
  }

  protected _calcChainableHelper(operandValue: any): PlywoodValue {
    return operandValue ? this.duration.floor(operandValue, this.getTimezone()) : null;
  }

  protected _getJSChainableHelper(operandJS: string): string {
    throw new Error("implement me");
  }

  protected _getSQLChainableHelper(dialect: SQLDialect, operandSQL: string): string {
    return dialect.timeFloorExpression(operandSQL, this.duration, this.getTimezone());
  }

  public alignsWith(ex: Expression): boolean {
    const { timezone, duration } = this;
    if (!timezone) return false;

    if (ex instanceof TimeFloorExpression || ex instanceof TimeBucketExpression) {
      return timezone.equals(ex.timezone) && ex.duration.dividesBy(duration);
    }

    if (ex instanceof InExpression || ex instanceof OverlapExpression) {
      let literal = ex.expression.getLiteralValue();
      if (literal instanceof TimeRange) {
        return literal.isAligned(duration, timezone);
      } else if (literal instanceof Set) {
        if (literal.setType !== 'TIME_RANGE') return false;
        return literal.elements.every((e: TimeRange) => {
          return e.isAligned(duration, timezone);
        });
      }
    }

    return false;
  }

  public specialSimplify(): Expression {
    const { operand, duration, timezone } = this;

    // _.timeFloor(d, tz).timeFloor(duration, timezone)
    if (operand instanceof TimeFloorExpression) {
      const { duration: d, timezone: tz } = operand;
      if (duration.equals(d) && immutableEqual(timezone, tz)) return operand;
    }

    return this;
  }

  // HasTimezone mixin:
  public getTimezone: () => Timezone;
  public changeTimezone: (timezone: Timezone) => TimeFloorExpression;
}

Expression.applyMixins(TimeFloorExpression, [HasTimezone]);
Expression.register(TimeFloorExpression);

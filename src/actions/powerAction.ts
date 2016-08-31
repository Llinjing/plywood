/*
 * Copyright 2015-2016 Imply Data, Inc.
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


import { Action, ActionJS, ActionValue } from "./baseAction";
import { PlyType, DatasetFullType, PlyTypeSingleValue, FullType } from "../types";
import { Expression, Indexer, Alterations } from "../expressions/baseExpression";
import { SQLDialect } from "../dialect/baseDialect";
import { Datum, ComputeFn } from "../datatypes/dataset";
import { RefExpression } from "../expressions/refExpression";

export class PowerAction extends Action {
  static fromJS(parameters: ActionJS): PowerAction {
    return new PowerAction(Action.jsToValue(parameters));
  }

  constructor(parameters: ActionValue) {
    super(parameters, dummyObject);
    this._ensureAction("power");
    this._checkExpressionTypes('NUMBER');
  }

  public getNecessaryInputTypes(): PlyType | PlyType[] {
    return 'NUMBER';
  }

  public getOutputType(inputType: PlyType): PlyType {
    this._checkInputTypes(inputType);
    return 'NUMBER';
  }

  public _fillRefSubstitutions(typeContext: DatasetFullType, inputType: FullType, indexer: Indexer, alterations: Alterations): FullType {
    this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
    return inputType;
  }

  protected _getFnHelper(inputType: PlyType, inputFn: ComputeFn, expressionFn: ComputeFn): ComputeFn {
    return (d: Datum, c: Datum) => {
      return Math.pow((inputFn(d, c) || 0), (expressionFn(d, c) || 0));
    };
  }

  protected _getJSHelper(inputType: PlyType, inputJS: string, expressionJS: string): string {
    return `Math.pow(${inputJS},${expressionJS})`;
  }

  protected _getSQLHelper(inputType: PlyType, dialect: SQLDialect, inputSQL: string, expressionSQL: string): string {
    return `POW(${inputSQL},${expressionSQL})`;
  }

  protected _removeAction(): boolean {
    return this.expression.equals(Expression.ONE);
  }

  protected _performOnRef(simpleExpression: RefExpression): Expression {
    if (this.expression.equals(Expression.ZERO)) return simpleExpression;
    return null;
  }

}

Action.register(PowerAction);

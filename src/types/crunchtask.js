/**
 * Created by andrew on 4/23/16.
 */
import * as C from '../constants/index';
import nextUid from '../utils/nextUid';
import type from '../utils/type';
// import together from './utils/together';
import partial from '../utils/partial';
import globals from '../utils/globals';
import defer from '../utils/defer';


import { getExecutableFor } from '../essentials/executables';
import { serveEvents } from '../essentials/events';
import { config, defaultConfig } from '../essentials/config';
import { makeRunInstanceApi } from '../essentials/runInstanceApi';
import { processDescriptionFn } from '../essentials/processDescriptionFn';

import * as S from '../static/index';


class CrunchInstancePromise {
  constructor(fn) {
    return new Promise(fn);
  }
}

class CrunchInstance extends CrunchInstancePromise {
  constructor(thisTask, descriptionFn, taskEvents, args) {

    let promiseControl = null;
    super((resolve, reject) => {
      promiseControl = {
        resolve,
        reject
      };
    });

    const parentTask = globals.staticParentTask;
    globals.staticParentTask = null;

    const runCtx = {
      task : thisTask,
      parentTask,
      id: `T_${thisTask.id}:${nextUid()}`,
      conditionsToMeet: 1,
      state: C.STATE_NAMES.init,
      runBlock: 0,
      runArgs: args,
      descriptionFn
    };

    const instanceApi = makeRunInstanceApi(runCtx, taskEvents, this, promiseControl);

    Object.assign(this, {
      onError: partial(this, instanceApi.runEventsOn, C.EVENT_NAMES.error),

      abort : partial(this, instanceApi.abort),
      pause : partial(this, instanceApi.pause),
      resume: partial(this, instanceApi.resume),

      done  : partial(this, instanceApi.runEventsOn, C.EVENT_NAMES.done),
      fail  : partial(this, instanceApi.runEventsOn, C.EVENT_NAMES.fail),
      always: partial(this, instanceApi.runEventsOn, [C.EVENT_NAMES.done, C.EVENT_NAMES.fail, C.EVENT_NAMES.error].join()),

      progress  : partial(this, instanceApi.runEventsOn, C.EVENT_NAMES.progress)

    });

    defer.call(runCtx, 0, processDescriptionFn, [instanceApi] );
  }
}


class CrunchExec {
  constructor(descriptionFn) {
    let result, events;
    try {
      return (result = (...args) => new CrunchInstance(this, descriptionFn, events, args ));
    } finally {
      result.events = events = serveEvents(result);
    }
  }
}


class Crunchtask extends CrunchExec {
  constructor(descriptionFn) {
    const then = (...tasks) => {
      const doneHandler = (...args) => {
        let task;
        while (task = (tasks || []).shift()) {
          getExecutableFor(task)(args);
        }
      };
      let newTask;
      try {
        newTask = new Crunchtask(descriptionFn);
      }
      finally {
        newTask.done(doneHandler);
        this.done(doneHandler);
      }
    };

    super(descriptionFn);

    const events = this.events;
    delete this.events;

    Object.assign(this, {
      id: nextUid(),
      timestamp: new Date() - 0,
      runCount: 0,
      then,
      onRun: partial(events.on, C.EVENT_NAMES.run),
      onIdle: partial(events.on, C.EVENT_NAMES.idle),
      onError: partial(events.on, C.EVENT_NAMES.error),
      done: partial(events.on, C.EVENT_NAMES.done),
      fail: partial(events.on, C.EVENT_NAMES.fail),
      always: partial(events.on, [
        C.EVENT_NAMES.done, C.EVENT_NAMES.fail, C.EVENT_NAMES.error
      ].join()),
      progress: partial(events.on, C.EVENT_NAMES.progress),
      isIdle: () => this.runCount === 0,
      pause: () => {
        this.isPaused = true;
        return this;
      },
      resume: () =>{
        delete this.isPaused;
        return this;
      },
      abort: () => {
        this.isAborted = true;
        return this;
      },
      _signalIdle() {
        if (!globals.staticSecurityLock) {
          return;
        }
        globals.staticSecurityLock = false;
        events.trigger(C.EVENT_NAMES.idle);
      }
    });
  }
}

Object.assign(Crunchtask, {
  /**
   * @deprecated use range
   * @type {staticFor}
   */
  'for': S.staticFor,
  range: S.staticFor,
  rangeCheck: S.normalizeRanges,

  /**
   * @deprecated use range
   * @type {Range}
   */
  rangeNextAndCheck(range, checkOnly) {
    return range.canAdvance(checkOnly);
  },

  forEach: S.staticForEach,
  reduce: S.staticReduce,

  /**
   *
   * @param {{boolean}|{ timeLimit:Number, timeoutAmount:Number, debug:boolean }} obj
   */
  config: function _config(obj) {
    if (!type.isObject(obj)) {
      return _config(defaultConfig);
    }

    const result = {};
    const __hasOwnProperty = {}.hasOwnProperty;

    for (let prop in obj) {
      //noinspection JSUnfilteredForInLoop
      if (__hasOwnProperty.call(obj, prop) && __hasOwnProperty.call(config, prop)) {
        //noinspection JSUnfilteredForInLoop
        config[prop] = obj[prop];
        //noinspection JSUnfilteredForInLoop
        result[prop] = obj[prop];
      }
    }

    return result;
  }
});

Object.assign(type, {
  isBuddy(input) {
    return input instanceof Crunchtask;
  },
  getTaskType() {
    return Crunchtask;
  }

});

export default Crunchtask;
import { isPlainObject } from 'lodash'
import { REHYDRATE } from './constants'

export default function autoRehydrate (config = {}) {
  return (next) => (reducer, initialState, enhancer) => {
    return next(createRehydrationReducer(reducer), initialState, enhancer)
  }

  function createRehydrationReducer (reducer) {
    let rehydrated = false
    let preRehydrateActions = []
    return (state, action) => {
      if (action.type !== REHYDRATE) {
        if (config.log && !rehydrated) preRehydrateActions.push(action) // store pre-rehydrate actions for debugging
        return reducer(state, action)
      } else {
        if (config.log && !rehydrated) logPreRehydrate(preRehydrateActions)
        rehydrated = true

        let inboundState = action.payload
        let reducedState = reducer(state, action)
        let newState = {...reducedState}

        Object.keys(inboundState).forEach((key) => {
          // if initialState does not have key, skip auto rehydration
          if (!state.hasOwnProperty(key)) return

          // if reducer modifies substate, skip auto rehydration
          if (state[key] !== reducedState[key]) {
            if (config.log) console.log('redux-persist/autoRehydrate: sub state for key `%s` modified, skipping autoRehydrate.', key)
            newState[key] = reducedState[key]
            return
          }

          // otherwise take the inboundState
          if (checkIfPlain(inboundState[key], reducedState[key])) newState[key] = {...state[key], ...inboundState[key]} // shallow merge
          else newState[key] = inboundState[key] // hard set

          if (config.log) console.log('redux-persist/autoRehydrate: key `%s`, rehydrated to ', key, newState[key])
        })
        return newState
      }
    }
  }
}

function checkIfPlain (a, b) {
  // isPlainObject + duck type not immutable
  if (!a || !b) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (typeof a.mergeDeep === 'function' || typeof b.mergeDeep === 'function') return false
  if (!isPlainObject(a) || !isPlainObject(b)) return false
  return true
}

function logPreRehydrate (preRehydrateActions) {
  if (preRehydrateActions.length > 0) {
    console.log(`
      redux-persist/autoRehydrate: %d actions were fired before rehydration completed. This can be a symptom of a race
      condition where the rehydrate action may overwrite the previously affected state. Consider running these actions
      after rehydration:
    `, preRehydrateActions)
  }
}

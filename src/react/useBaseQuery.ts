import React from 'react'

import { notifyManager } from '../core/notifyManager'
import { QueryObserver } from '../core/queryObserver'
import { useQueryErrorResetBoundary } from './QueryErrorResetBoundary'
import { useQueryClient } from './QueryClientProvider'
import { UseBaseQueryOptions } from './types'

export function useBaseQuery<TData, TError, TQueryFnData, TQueryData>(
  options: UseBaseQueryOptions<TData, TError, TQueryFnData, TQueryData>,
  Observer: typeof QueryObserver
) {
  const queryClient = useQueryClient()
  const errorResetBoundary = useQueryErrorResetBoundary()
  const defaultedOptions = queryClient.defaultQueryObserverOptions(options)

  // Batch calls to callbacks if not in suspense mode
  if (!defaultedOptions.suspense) {
    if (defaultedOptions.onError) {
      defaultedOptions.onError = notifyManager.batchCalls(
        defaultedOptions.onError
      )
    }

    if (defaultedOptions.onSuccess) {
      defaultedOptions.onSuccess = notifyManager.batchCalls(
        defaultedOptions.onSuccess
      )
    }

    if (defaultedOptions.onSettled) {
      defaultedOptions.onSettled = notifyManager.batchCalls(
        defaultedOptions.onSettled
      )
    }
  }

  // Always set stale time when using suspense
  if (defaultedOptions.suspense && !defaultedOptions.staleTime) {
    defaultedOptions.staleTime = 2000
  }

  // Create query observer
  const observerRef = React.useRef<QueryObserver<any, any, any, any>>()
  const observer =
    observerRef.current || new Observer(queryClient, defaultedOptions)
  observerRef.current = observer

  // Update options
  if (observer.hasListeners()) {
    observer.setOptions(defaultedOptions)
  }

  const [currentResult, setCurrentResult] = React.useState(() =>
    observer.getCurrentResult()
  )

  // Subscribe to the observer
  React.useEffect(() => {
    errorResetBoundary.clearReset()
    return observer.subscribe(notifyManager.batchCalls(setCurrentResult))
  }, [observer, errorResetBoundary])

  // Handle suspense
  if (observer.options.suspense || observer.options.useErrorBoundary) {
    if (
      currentResult.isError &&
      !errorResetBoundary.isReset() &&
      !observer.getCurrentQuery().isFetching()
    ) {
      throw currentResult.error
    }

    if (
      observer.options.suspense &&
      !observer.hasListeners() &&
      observer.willFetchOnMount()
    ) {
      errorResetBoundary.clearReset()
      throw observer.getNextResult({ throwOnError: true })
    }
  }

  return currentResult
}

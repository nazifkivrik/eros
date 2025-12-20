"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Configuration options for the mutation with toast
 */
interface MutationWithToastOptions<TData, TVariables> {
  /**
   * The mutation function to execute
   */
  mutationFn: (variables: TVariables) => Promise<TData>;

  /**
   * Success toast message
   */
  successMessage: string;

  /**
   * Query keys to invalidate on success
   */
  invalidateKeys?: QueryKey[];

  /**
   * Optional custom success callback
   */
  onSuccess?: (data: TData, variables: TVariables) => void;

  /**
   * Optional custom error message or function
   */
  errorMessage?: string | ((error: Error) => string);

  /**
   * Optional custom error callback
   */
  onError?: (error: Error, variables: TVariables) => void;
}

/**
 * Custom hook that wraps useMutation with standardized toast notifications
 * and query invalidation patterns.
 *
 * This eliminates the need for repetitive onSuccess/onError handlers across hooks.
 *
 * @example
 * ```ts
 * const deleteMutation = useMutationWithToast({
 *   mutationFn: (id: string) => apiClient.delete(id),
 *   successMessage: "Item deleted",
 *   invalidateKeys: [queryKeys.items.all],
 * });
 * ```
 */
export function useMutationWithToast<TData = unknown, TVariables = void>({
  mutationFn,
  successMessage,
  invalidateKeys = [],
  onSuccess,
  errorMessage = "Operation failed",
  onError,
}: MutationWithToastOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      // Invalidate specified query keys
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      // Show success toast
      toast.success(successMessage);

      // Call custom success callback if provided
      onSuccess?.(data, variables);
    },
    onError: (error: Error, variables) => {
      // Show error toast
      const message =
        typeof errorMessage === "function"
          ? errorMessage(error)
          : error.message || errorMessage;
      toast.error(message);

      // Call custom error callback if provided
      onError?.(error, variables);
    },
  });
}

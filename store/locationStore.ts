import { create } from 'zustand'
import { Location, LocationNode } from '@/lib/validations/location'

interface LocationStore {
  tree: LocationNode[]
  flatList: Location[]
  isLoading: boolean
  error: string | null
  setTree: (tree: LocationNode[]) => void
  setFlatList: (list: Location[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useLocationStore = create<LocationStore>((set) => ({
  tree: [],
  flatList: [],
  isLoading: false,
  error: null,
  setTree: (tree) => set({ tree }),
  setFlatList: (flatList) => set({ flatList }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))

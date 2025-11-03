import { useState, useEffect } from 'react';
import { listingsStore } from '../data/store';

// Simple hook to provide listings and basic search/filter helpers.
export function useListings() {
  const [listings, setListings] = useState(listingsStore.getListings());

  useEffect(() => {
    const unsubscribe = listingsStore.subscribe(() => {
      setListings(listingsStore.getListings());
    });
    return unsubscribe; // Clean up the subscription on unmount
  }, []);

  return listings;
}

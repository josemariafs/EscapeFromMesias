import { useCallback, useState } from 'react';

export type DataSourceMode = 'localStorage' | 'logs';

export const DATA_SOURCE_STORAGE_KEY = 'efg-data-source';

function readStoredDataSource(): DataSourceMode {
  const stored = localStorage.getItem(DATA_SOURCE_STORAGE_KEY);
  return stored === 'logs' ? 'logs' : 'localStorage';
}

export function useDataSource() {
  const [dataSource, setDataSourceState] = useState<DataSourceMode>(readStoredDataSource);

  const setDataSource = useCallback((mode: DataSourceMode) => {
    setDataSourceState(mode);
    localStorage.setItem(DATA_SOURCE_STORAGE_KEY, mode);
  }, []);

  return {
    dataSource,
    setDataSource,
    isLogsMode: dataSource === 'logs',
  };
}

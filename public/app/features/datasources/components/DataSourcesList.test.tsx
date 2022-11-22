import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import { getMockDataSources } from '../__mocks__';

import { DataSourcesListView } from './DataSourcesList';

const setup = () => {
  const store = configureStore();

  return render(
    <Provider store={store}>
      <DataSourcesListView
        dataSources={getMockDataSources(3)}
        dataSourcesCount={3}
        isLoading={false}
        hasCreateRights={true}
      />
    </Provider>
  );
};

describe('<DataSourcesList>', () => {
  it('should render action bar', async () => {
    setup();

    expect(await screen.findByPlaceholderText('Search by name or type')).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
  });

  it('should render list of datasources', async () => {
    setup();

    expect(await screen.findAllByRole('listitem')).toHaveLength(3);
    expect(await screen.findAllByRole('heading')).toHaveLength(3);
  });

  it('should render all elements in the list item', async () => {
    setup();

    expect(await screen.findByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'dataSource-0' })).toBeInTheDocument();
  });
});

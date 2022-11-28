import { PluginType, PluginState, PluginSignatureStatus } from '@grafana/data';

const baseUrl = 'plugin-cdn';

const dummyPanel = {
  info: {
    author: {
      name: 'Grafana Labs',
      url: 'https://grafana.com',
    },
    links: [
      {
        name: 'Project site',
        url: 'https://github.com/grafana/clock-panel',
      },
      {
        name: 'MIT License',
        url: 'https://github.com/grafana/clock-panel/blob/master/LICENSE',
      },
    ],
    build: {
      time: 1657138674187,
      repo: 'https://github.com/grafana/clock-panel',
      branch: 'master',
      hash: 'dfcdaf668efc3a5a5845b245313832b2eaa8df2f',
    },
    screenshots: [
      {
        name: 'Showcase',
        path: `/img/screenshot-showcase.png`,
      },
      {
        name: 'Options',
        path: `/img/screenshot-clock-options.png`,
      },
    ],
    updated: '2022-07-06',
  },
  hideFromList: false,
  sort: 100,
  skipDataQuery: true,
  state: PluginState.stable,
  signature: PluginSignatureStatus.valid,
  type: PluginType.panel,
};

const dummyData = [
  {
    id: 'vonage-status-panel',
    name: 'Status Panel',
    info: {
      description: 'Status Panel for Grafana',
      logos: {
        small: `${baseUrl}/vonage-status-panel/1.0.11/img/icon_status_panel.svg`,
        large: `${baseUrl}/vonage-status-panel/1.0.11/img/icon_status_panel.svg`,
      },
      version: '1.0.11',
    },
    baseUrl: `${baseUrl}/vonage-status-panel/1.0.11/`,
    module: `${baseUrl}/vonage-status-panel/1.0.11/module`,
  },
  {
    id: 'volkovlabs-form-panel',
    name: 'Data Manipulation',
    info: {
      description: 'Data Manipulation Panel',
      logos: {
        large: `${baseUrl}/volkovlabs-form-panel/2.7.0/img/logo.svg`,
        small: `${baseUrl}/volkovlabs-form-panel/2.7.0/img/logo.svg`,
      },
      version: '2.7.0',
    },
    baseUrl: `${baseUrl}/volkovlabs-form-panel/2.7.0`,
    module: `${baseUrl}/volkovlabs-form-panel/2.7.0/module`,
  },
  {
    id: 'grafana-worldmap-panel',
    name: 'Worldmap Panel',
    info: {
      description:
        'World Map panel for Grafana. Displays time series data or geohash data from Elasticsearch overlaid on a world map.',
      logos: {
        small: `${baseUrl}/grafana-worldmap-panel/0.3.3/images/worldmap_logo.svg`,
        large: `${baseUrl}/grafana-worldmap-panel/0.3.3/images/worldmap_logo.svg`,
      },
      version: '0.3.3',
    },
    baseUrl: `${baseUrl}/grafana-worldmap-panel/0.3.3`,
    module: `${baseUrl}/grafana-worldmap-panel/0.3.3/module`,
  },
  {
    id: 'jdbranham-diagram-panel',
    name: 'Diagram',
    info: {
      description: 'Display diagrams and charts with colored metric indicators',
      logos: {
        small: `${baseUrl}/jdbranham-diagram-panel/1.7.3/img/logo.svg`,
        large: `${baseUrl}/jdbranham-diagram-panel/1.7.3/img/logo.svg`,
      },
      version: '1.7.3',
    },
    baseUrl: `${baseUrl}/jdbranham-diagram-panel/1.7.3`,
    module: `${baseUrl}/jdbranham-diagram-panel/1.7.3/module`,
  },
  {
    id: 'grafana-polystat-panel',
    name: 'Polystat',
    info: {
      description: 'Polystat panel for Grafana',
      logos: {
        large: `${baseUrl}/grafana-polystat-panel/2.0.4/img/polystat.svg`,
        small: `${baseUrl}/grafana-polystat-panel/2.0.4/img/polystat.svg`,
      },
      version: '2.0.4',
    },
    baseUrl: `${baseUrl}/grafana-polystat-panel/2.0.4`,
    module: `${baseUrl}/grafana-polystat-panel/2.0.4/module`,
  },
  {
    id: 'natel-plotly-panel',
    name: 'Plotly',
    info: {
      description: 'Scatter plots and more',
      logos: {
        small: `${baseUrl}/natel-plotly-panel/0.0.7/img/plotly_logo.svg`,
        large: `${baseUrl}/natel-plotly-panel/0.0.7/img/plotly_logo.svg`,
      },
      version: '0.0.7',
    },
    baseUrl: `${baseUrl}/natel-plotly-panel/0.0.7`,
    module: `${baseUrl}/natel-plotly-panel/0.0.7/module`,
  },
  {
    id: 'briangann-gauge-panel',
    name: 'D3 Gauge',
    info: {
      description: 'D3-based Gauge panel for Grafana',
      logos: {
        small: `${baseUrl}/briangann-gauge-panel/0.0.9/img/Logo_D3.svg`,
        large: `${baseUrl}/briangann-gauge-panel/0.0.9/img/Logo_D3.svg`,
      },
      version: '0.0.9',
    },
    baseUrl: `${baseUrl}/briangann-gauge-panel/0.0.9`,
    module: `${baseUrl}/briangann-gauge-panel/0.0.9/module`,
  },
  {
    id: 'agenty-flowcharting-panel',
    name: 'FlowCharting',
    info: {
      dscription:
        'Flowcharting is a Grafana plugin. Use it to display complexe diagrams using the online graphing library draw.io like a vsio',
      logos: {
        small: `${baseUrl}/agenty-flowcharting-panel/0.9.1/img/agenty-flowcharting.svg`,
        large: `${baseUrl}/agenty-flowcharting-panel/0.9.1/img/agenty-flowcharting.svg`,
      },
      version: '0.9.1',
    },
    baseUrl: `${baseUrl}/agenty-flowcharting-panel/0.9.1`,
    module: `${baseUrl}/agenty-flowcharting-panel/0.9.1/module`,
  },
  {
    id: 'natel-discrete-panel',
    name: 'Discrete',
    info: {
      description: 'Discrete Events grafana',
      logos: {
        small: `${baseUrl}/natel-discrete-panel/0.1.1/img/discrete_logo.svg`,
        large: `${baseUrl}/natel-discrete-panel/0.1.1/img/discrete_logo.svg`,
      },
      version: '0.1.1',
    },
    baseUrl: `${baseUrl}/natel-discrete-panel/0.1.1`,
    module: `${baseUrl}/natel-discrete-panel/0.1.1/module`,
  },
  {
    id: 'grafana-clock-panel',
    name: 'Clock',
    info: {
      description: 'Clock panel for grafana',
      logos: {
        small: `${baseUrl}/grafana-clock-panel/2.1.0/img/clock.svg`,
        large: `${baseUrl}/grafana-clock-panel/2.1.0/img/clock.svg`,
      },
      version: '2.1.0',
    },
    baseUrl: `${baseUrl}/grafana-clock-panel/2.1.0`,
    module: `${baseUrl}/grafana-clock-panel/2.1.0/module`,
  },
];

export const remotePanels = dummyData.reduce((acc, item) => {
  // @ts-ignore YOLO!!!!!!
  acc[item.id] = {
    ...dummyPanel,
    ...item,
    info: {
      ...dummyPanel.info,
      ...item.info,
    },
  };
  return acc;
}, {});

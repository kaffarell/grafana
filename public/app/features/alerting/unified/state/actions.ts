import { getBackendSrv, locationService } from '@grafana/runtime';
import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  AlertmanagerAlert,
  ExternalAlertmanagerConfig,
  AlertManagerCortexConfig,
  AlertmanagerGroup,
  ExternalAlertmanagersResponse,
  Receiver,
  Silence,
  SilenceCreatePayload,
  TestReceiversAlert,
} from 'app/plugins/datasource/alertmanager/types';
import { FolderDTO, NotifierDTO, ThunkResult } from 'app/types';
import {
  CombinedRuleGroup,
  CombinedRuleNamespace,
  RuleIdentifier,
  RuleNamespace,
  RuleWithLocation,
  StateHistoryItem,
} from 'app/types/unified-alerting';
import {
  PostableRuleGrafanaRuleDTO,
  PostableRulerRuleGroupDTO,
  RulerGrafanaRuleDTO,
  RulerRuleGroupDTO,
  RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';
import { fetchNotifiers } from '../api/grafana';
import { fetchAnnotations } from '../api/annotations';
import {
  expireSilence,
  fetchAlertManagerConfig,
  fetchAlerts,
  fetchAlertGroups,
  fetchSilences,
  createOrUpdateSilence,
  updateAlertManagerConfig,
  fetchStatus,
  deleteAlertManagerConfig,
  testReceivers,
  addAlertManagers,
  fetchExternalAlertmanagers,
  fetchExternalAlertmanagerConfig,
} from '../api/alertmanager';
import { FetchPromRulesFilter, fetchRules } from '../api/prometheus';
import {
  deleteNamespace,
  deleteRulerRulesGroup,
  fetchRulerRules,
  fetchRulerRulesGroup,
  FetchRulerRulesFilter,
  setRulerRuleGroup,
} from '../api/ruler';
import { RuleFormType, RuleFormValues } from '../types/rule-form';
import {
  getAllRulesSourceNames,
  getRulesSourceName,
  GRAFANA_RULES_SOURCE_NAME,
  isVanillaPrometheusAlertManagerDataSource,
} from '../utils/datasource';
import { makeAMLink, retryWhile } from '../utils/misc';
import { withAppEvents, withSerializedError } from '../utils/redux';
import { formValuesToRulerRuleDTO, formValuesToRulerGrafanaRuleDTO } from '../utils/rule-form';
import {
  isCloudRuleIdentifier,
  isGrafanaRuleIdentifier,
  isGrafanaRulerRule,
  isPrometheusRuleIdentifier,
  isRulerNotSupportedResponse,
} from '../utils/rules';
import { addDefaultsToAlertmanagerConfig, removeMuteTimingFromRoute, isFetchError } from '../utils/alertmanager';
import * as ruleId from '../utils/rule-id';
import { isEmpty } from 'lodash';
import messageFromError from 'app/plugins/datasource/grafana-azure-monitor-datasource/utils/messageFromError';
import { RULER_NOT_SUPPORTED_MSG } from '../utils/constants';

const FETCH_CONFIG_RETRY_TIMEOUT = 30 * 1000;

export const fetchPromRulesAction = createAsyncThunk(
  'unifiedalerting/fetchPromRules',
  ({ rulesSourceName, filter }: { rulesSourceName: string; filter?: FetchPromRulesFilter }): Promise<RuleNamespace[]> =>
    withSerializedError(fetchRules(rulesSourceName, filter))
);

export const fetchAlertManagerConfigAction = createAsyncThunk(
  'unifiedalerting/fetchAmConfig',
  (alertManagerSourceName: string): Promise<AlertManagerCortexConfig> =>
    withSerializedError(
      (async () => {
        // for vanilla prometheus, there is no config endpoint. Only fetch config from status
        if (isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName)) {
          return fetchStatus(alertManagerSourceName).then((status) => ({
            alertmanager_config: status.config,
            template_files: {},
          }));
        }

        return retryWhile(
          () => fetchAlertManagerConfig(alertManagerSourceName),
          // if config has been recently deleted, it takes a while for cortex start returning the default one.
          // retry for a short while instead of failing
          (e) => !!messageFromError(e)?.includes('alertmanager storage object not found'),
          FETCH_CONFIG_RETRY_TIMEOUT
        ).then((result) => {
          // if user config is empty for cortex alertmanager, try to get config from status endpoint
          if (
            isEmpty(result.alertmanager_config) &&
            isEmpty(result.template_files) &&
            alertManagerSourceName !== GRAFANA_RULES_SOURCE_NAME
          ) {
            return fetchStatus(alertManagerSourceName).then((status) => ({
              alertmanager_config: status.config,
              template_files: {},
            }));
          }
          return result;
        });
      })()
    )
);

export const fetchExternalAlertmanagersAction = createAsyncThunk(
  'unifiedAlerting/fetchExternalAlertmanagers',
  (): Promise<ExternalAlertmanagersResponse> => {
    return withSerializedError(fetchExternalAlertmanagers());
  }
);

export const fetchExternalAlertmanagersConfigAction = createAsyncThunk(
  'unifiedAlerting/fetchExternAlertmanagersConfig',
  (): Promise<ExternalAlertmanagerConfig> => {
    return withSerializedError(fetchExternalAlertmanagerConfig());
  }
);

export const fetchRulerRulesAction = createAsyncThunk(
  'unifiedalerting/fetchRulerRules',
  ({
    rulesSourceName,
    filter,
  }: {
    rulesSourceName: string;
    filter?: FetchRulerRulesFilter;
  }): Promise<RulerRulesConfigDTO | null> => {
    return withSerializedError(fetchRulerRules(rulesSourceName, filter));
  }
);

export const fetchSilencesAction = createAsyncThunk(
  'unifiedalerting/fetchSilences',
  (alertManagerSourceName: string): Promise<Silence[]> => {
    return withSerializedError(fetchSilences(alertManagerSourceName));
  }
);

// this will only trigger ruler rules fetch if rules are not loaded yet and request is not in flight
export function fetchRulerRulesIfNotFetchedYet(rulesSourceName: string): ThunkResult<void> {
  return (dispatch, getStore) => {
    const { rulerRules } = getStore().unifiedAlerting;
    const resp = rulerRules[rulesSourceName];
    if (!resp?.result && !(resp && isRulerNotSupportedResponse(resp)) && !resp?.loading) {
      dispatch(fetchRulerRulesAction({ rulesSourceName }));
    }
  };
}

export function fetchAllPromAndRulerRulesAction(force = false): ThunkResult<void> {
  return (dispatch, getStore) => {
    const { promRules, rulerRules } = getStore().unifiedAlerting;
    getAllRulesSourceNames().map((rulesSourceName) => {
      if (force || !promRules[rulesSourceName]?.loading) {
        dispatch(fetchPromRulesAction({ rulesSourceName }));
      }
      if (force || !rulerRules[rulesSourceName]?.loading) {
        dispatch(fetchRulerRulesAction({ rulesSourceName }));
      }
    });
  };
}

export function fetchAllPromRulesAction(force = false): ThunkResult<void> {
  return (dispatch, getStore) => {
    const { promRules } = getStore().unifiedAlerting;
    getAllRulesSourceNames().map((rulesSourceName) => {
      if (force || !promRules[rulesSourceName]?.loading) {
        dispatch(fetchPromRulesAction({ rulesSourceName }));
      }
    });
  };
}

async function findEditableRule(ruleIdentifier: RuleIdentifier): Promise<RuleWithLocation | null> {
  if (isGrafanaRuleIdentifier(ruleIdentifier)) {
    const namespaces = await fetchRulerRules(GRAFANA_RULES_SOURCE_NAME);
    // find namespace and group that contains the uid for the rule
    for (const [namespace, groups] of Object.entries(namespaces)) {
      for (const group of groups) {
        const rule = group.rules.find(
          (rule) => isGrafanaRulerRule(rule) && rule.grafana_alert?.uid === ruleIdentifier.uid
        );
        if (rule) {
          return {
            group,
            ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
            namespace: namespace,
            rule,
          };
        }
      }
    }
  }

  if (isCloudRuleIdentifier(ruleIdentifier)) {
    const { ruleSourceName, namespace, groupName } = ruleIdentifier;
    const group = await fetchRulerRulesGroup(ruleSourceName, namespace, groupName);

    if (!group) {
      return null;
    }

    const rule = group.rules.find((rule) => {
      const identifier = ruleId.fromRulerRule(ruleSourceName, namespace, group.name, rule);
      return ruleId.equal(identifier, ruleIdentifier);
    });

    if (!rule) {
      return null;
    }

    return {
      group,
      ruleSourceName,
      namespace,
      rule,
    };
  }

  if (isPrometheusRuleIdentifier(ruleIdentifier)) {
    throw new Error('Native prometheus rules can not be edited in grafana.');
  }

  return null;
}

export const fetchEditableRuleAction = createAsyncThunk(
  'unifiedalerting/fetchEditableRule',
  (ruleIdentifier: RuleIdentifier): Promise<RuleWithLocation | null> =>
    withSerializedError(findEditableRule(ruleIdentifier))
);

async function deleteRule(ruleWithLocation: RuleWithLocation): Promise<void> {
  const { ruleSourceName, namespace, group, rule } = ruleWithLocation;

  // it was the last rule, delete the entire group
  if (group.rules.length === 1) {
    await deleteRulerRulesGroup(ruleSourceName, namespace, group.name);
    return;
  }
  // post the group with rule removed
  await setRulerRuleGroup(ruleSourceName, namespace, {
    ...group,
    rules: group.rules.filter((r) => r !== rule),
  });
}

export function deleteRulesGroupAction(
  namespace: CombinedRuleNamespace,
  ruleGroup: CombinedRuleGroup
): ThunkResult<void> {
  return async (dispatch) => {
    withAppEvents(
      (async () => {
        const sourceName = getRulesSourceName(namespace.rulesSource);

        await deleteRulerRulesGroup(sourceName, namespace.name, ruleGroup.name);
        dispatch(fetchRulerRulesAction({ rulesSourceName: sourceName }));
        dispatch(fetchPromRulesAction({ rulesSourceName: sourceName }));
      })(),
      { successMessage: 'Group deleted' }
    );
  };
}

export function deleteRuleAction(
  ruleIdentifier: RuleIdentifier,
  options: { navigateTo?: string } = {}
): ThunkResult<void> {
  /*
   * fetch the rules group from backend, delete group if it is found and+
   * reload ruler rules
   */
  return async (dispatch) => {
    withAppEvents(
      (async () => {
        const ruleWithLocation = await findEditableRule(ruleIdentifier);
        if (!ruleWithLocation) {
          throw new Error('Rule not found.');
        }
        await deleteRule(ruleWithLocation);
        // refetch rules for this rules source
        dispatch(fetchRulerRulesAction({ rulesSourceName: ruleWithLocation.ruleSourceName }));
        dispatch(fetchPromRulesAction({ rulesSourceName: ruleWithLocation.ruleSourceName }));

        if (options.navigateTo) {
          locationService.replace(options.navigateTo);
        }
      })(),
      {
        successMessage: 'Rule deleted.',
      }
    );
  };
}

async function saveLotexRule(values: RuleFormValues, existing?: RuleWithLocation): Promise<RuleIdentifier> {
  const { dataSourceName, group, namespace } = values;
  const formRule = formValuesToRulerRuleDTO(values);
  if (dataSourceName && group && namespace) {
    // if we're updating a rule...
    if (existing) {
      // refetch it so we always have the latest greatest
      const freshExisting = await findEditableRule(ruleId.fromRuleWithLocation(existing));
      if (!freshExisting) {
        throw new Error('Rule not found.');
      }
      // if namespace or group was changed, delete the old rule
      if (freshExisting.namespace !== namespace || freshExisting.group.name !== group) {
        await deleteRule(freshExisting);
      } else {
        // if same namespace or group, update the group replacing the old rule with new
        const payload = {
          ...freshExisting.group,
          rules: freshExisting.group.rules.map((existingRule) =>
            existingRule === freshExisting.rule ? formRule : existingRule
          ),
        };
        await setRulerRuleGroup(dataSourceName, namespace, payload);
        return ruleId.fromRulerRule(dataSourceName, namespace, group, formRule);
      }
    }

    // if creating new rule or existing rule was in a different namespace/group, create new rule in target group

    const targetGroup = await fetchRulerRulesGroup(dataSourceName, namespace, group);

    const payload: RulerRuleGroupDTO = targetGroup
      ? {
          ...targetGroup,
          rules: [...targetGroup.rules, formRule],
        }
      : {
          name: group,
          rules: [formRule],
        };

    await setRulerRuleGroup(dataSourceName, namespace, payload);
    return ruleId.fromRulerRule(dataSourceName, namespace, group, formRule);
  } else {
    throw new Error('Data source and location must be specified');
  }
}

async function saveGrafanaRule(values: RuleFormValues, existingRule?: RuleWithLocation): Promise<RuleIdentifier> {
  const { folder, group } = values;
  if (!folder) {
    throw new Error('Folder must be specified');
  }

  const newRule = formValuesToRulerGrafanaRuleDTO(values);
  const namespace = folder.title;

  // here are a couple of scenarios we have to think about
  // 1.1 if (existing) we are editing an existing rule
  // 1.2 if we are storing it in a different namespace or group from before we have to remove it from the previous group / namespace
  //
  // 2.1 if we are creating a new rule we have to add it to a group that might already exist
  if (existingRule) {
    const sameNamespace = existingRule.namespace === namespace;
    const sameGroup = existingRule.group.name === values.group;

    // we're update a rule in the same namespace and group
    if (sameNamespace && sameGroup) {
      return updateExistingGrafanaRule(existingRule, newRule);
    } else if (sameNamespace && !sameGroup) {
      // we're moving a rule in the same namespace to a different group
      return moveGrafanaRuleToOtherGroup(group, existingRule, newRule);
    } else if (!sameNamespace) {
      // we're moving a rule to a different namespace entirely
      return await moveGrafanaRuleToOtherNamespace(namespace, group, existingRule, newRule);
    }
  }

  // if we got this far we're creating a completely new rule and adding it to a namespace / group
  return await addRuleToNamespaceAndGroup(namespace, group, newRule);
}

// this function will move a single rule from one namespace to another
// since this operation cannot be atomic we first add it to a new namespace / group before we
// remove it from the old namespace / group
async function moveGrafanaRuleToOtherNamespace(
  namespace: string,
  group: string,
  existingRule: RuleWithLocation,
  newRule: PostableRuleGrafanaRuleDTO
): Promise<RuleIdentifier> {
  // add to new namespace / group
  await addRuleToNamespaceAndGroup(namespace, group, newRule);

  // remove from old namespace / group
  await deleteRule({
    ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
    namespace: existingRule.namespace,
    group: existingRule.group,
    rule: existingRule.rule,
  });

  // TODO figure out how to get the newly created UID :(
  return { uid: '' };
}

async function addRuleToNamespaceAndGroup(
  namespace: string,
  group: string,
  newRule: PostableRuleGrafanaRuleDTO
): Promise<RuleIdentifier> {
  const existingGroup = await fetchRulerRulesGroup(GRAFANA_RULES_SOURCE_NAME, namespace, group);
  if (!existingGroup) {
    throw new Error(`No group found with name "${group}"`);
  }

  const payload: PostableRulerRuleGroupDTO = {
    name: existingGroup.name,
    interval: existingGroup.interval,
    rules: existingGroup.rules.concat(newRule as RulerGrafanaRuleDTO),
  };

  await setRulerRuleGroup(GRAFANA_RULES_SOURCE_NAME, namespace, payload);

  // TODO figure out how to get the newly created UID :(
  return { uid: '' };
}

// we can't move the rule atomically so we have to
// 1. add the rule to the new group
// 2. remove the rule from the old one
async function moveGrafanaRuleToOtherGroup(
  group: string,
  existingRule: RuleWithLocation,
  newRule: PostableRuleGrafanaRuleDTO
): Promise<RuleIdentifier> {
  // add to new group
  const identifier = await addRuleToNamespaceAndGroup(existingRule.namespace, group, newRule);

  // remove from previous group
  await deleteRule(existingRule);

  return identifier;
}

async function updateExistingGrafanaRule(
  existingRule: RuleWithLocation,
  newRule: PostableRuleGrafanaRuleDTO
): Promise<RuleIdentifier> {
  // type guard to make sure we're working with a Grafana managed rule
  if (!isGrafanaRulerRule(existingRule.rule)) {
    throw new Error('The rule is not a Grafana managed rule');
  }

  // make sure our updated alert has the same UID as before
  const uid = existingRule.rule.grafana_alert.uid;
  newRule.grafana_alert.uid = uid;

  // create the new array of rules we want to send to the group
  const newRules = existingRule.group.rules
    .filter((rule): rule is RulerGrafanaRuleDTO => isGrafanaRulerRule(rule))
    .filter((rule) => rule.grafana_alert.uid !== uid)
    .concat(newRule as RulerGrafanaRuleDTO); // TODO why type cast this?

  await setRulerRuleGroup(GRAFANA_RULES_SOURCE_NAME, existingRule.namespace, {
    name: existingRule.group.name,
    interval: existingRule.group.interval,
    rules: newRules,
  });

  return { uid };
}

export const saveRuleFormAction = createAsyncThunk(
  'unifiedalerting/saveRuleForm',
  ({
    values,
    existing,
    redirectOnSave,
  }: {
    values: RuleFormValues;
    existing?: RuleWithLocation;
    redirectOnSave?: string;
  }): Promise<void> =>
    withAppEvents(
      withSerializedError(
        (async () => {
          const { type } = values;
          // in case of system (cortex/loki)
          let identifier: RuleIdentifier;
          if (type === RuleFormType.cloudAlerting || type === RuleFormType.cloudRecording) {
            identifier = await saveLotexRule(values, existing);
            // in case of grafana managed
          } else if (type === RuleFormType.grafana) {
            identifier = await saveGrafanaRule(values, existing);
          } else {
            throw new Error('Unexpected rule form type');
          }
          if (redirectOnSave) {
            locationService.push(redirectOnSave);
          } else {
            // redirect to edit page
            const newLocation = `/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`;
            if (locationService.getLocation().pathname !== newLocation) {
              locationService.replace(newLocation);
            }
          }
        })()
      ),
      {
        successMessage: existing ? `Rule "${values.name}" updated.` : `Rule "${values.name}" saved.`,
        errorMessage: 'Failed to save rule',
      }
    )
);

export const fetchGrafanaNotifiersAction = createAsyncThunk(
  'unifiedalerting/fetchGrafanaNotifiers',
  (): Promise<NotifierDTO[]> => withSerializedError(fetchNotifiers())
);

export const fetchGrafanaAnnotationsAction = createAsyncThunk(
  'unifiedalerting/fetchGrafanaAnnotations',
  (alertId: string): Promise<StateHistoryItem[]> => withSerializedError(fetchAnnotations(alertId))
);

interface UpdateAlertManagerConfigActionOptions {
  alertManagerSourceName: string;
  oldConfig: AlertManagerCortexConfig; // it will be checked to make sure it didn't change in the meanwhile
  newConfig: AlertManagerCortexConfig;
  successMessage?: string; // show toast on success
  redirectPath?: string; // where to redirect on success
  refetch?: boolean; // refetch config on success
}

export const updateAlertManagerConfigAction = createAsyncThunk<void, UpdateAlertManagerConfigActionOptions, {}>(
  'unifiedalerting/updateAMConfig',
  ({ alertManagerSourceName, oldConfig, newConfig, successMessage, redirectPath, refetch }, thunkAPI): Promise<void> =>
    withAppEvents(
      withSerializedError(
        (async () => {
          const latestConfig = await fetchAlertManagerConfig(alertManagerSourceName);
          if (
            !(isEmpty(latestConfig.alertmanager_config) && isEmpty(latestConfig.template_files)) &&
            JSON.stringify(latestConfig) !== JSON.stringify(oldConfig)
          ) {
            throw new Error(
              'It seems configuration has been recently updated. Please reload page and try again to make sure that recent changes are not overwritten.'
            );
          }
          await updateAlertManagerConfig(alertManagerSourceName, addDefaultsToAlertmanagerConfig(newConfig));
          if (refetch) {
            await thunkAPI.dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
          }
          if (redirectPath) {
            locationService.push(makeAMLink(redirectPath, alertManagerSourceName));
          }
        })()
      ),
      {
        successMessage,
      }
    )
);

export const fetchAmAlertsAction = createAsyncThunk(
  'unifiedalerting/fetchAmAlerts',
  (alertManagerSourceName: string): Promise<AlertmanagerAlert[]> =>
    withSerializedError(fetchAlerts(alertManagerSourceName, [], true, true, true))
);

export const expireSilenceAction = (alertManagerSourceName: string, silenceId: string): ThunkResult<void> => {
  return async (dispatch) => {
    await withAppEvents(expireSilence(alertManagerSourceName, silenceId), {
      successMessage: 'Silence expired.',
    });
    dispatch(fetchSilencesAction(alertManagerSourceName));
    dispatch(fetchAmAlertsAction(alertManagerSourceName));
  };
};

type UpdateSilenceActionOptions = {
  alertManagerSourceName: string;
  payload: SilenceCreatePayload;
  exitOnSave: boolean;
  successMessage?: string;
};

export const createOrUpdateSilenceAction = createAsyncThunk<void, UpdateSilenceActionOptions, {}>(
  'unifiedalerting/updateSilence',
  ({ alertManagerSourceName, payload, exitOnSave, successMessage }): Promise<void> =>
    withAppEvents(
      withSerializedError(
        (async () => {
          await createOrUpdateSilence(alertManagerSourceName, payload);
          if (exitOnSave) {
            locationService.push('/alerting/silences');
          }
        })()
      ),
      {
        successMessage,
      }
    )
);

export const deleteReceiverAction = (receiverName: string, alertManagerSourceName: string): ThunkResult<void> => {
  return (dispatch, getState) => {
    const config = getState().unifiedAlerting.amConfigs?.[alertManagerSourceName]?.result;
    if (!config) {
      throw new Error(`Config for ${alertManagerSourceName} not found`);
    }
    if (!config.alertmanager_config.receivers?.find((receiver) => receiver.name === receiverName)) {
      throw new Error(`Cannot delete receiver ${receiverName}: not found in config.`);
    }
    const newConfig: AlertManagerCortexConfig = {
      ...config,
      alertmanager_config: {
        ...config.alertmanager_config,
        receivers: config.alertmanager_config.receivers.filter((receiver) => receiver.name !== receiverName),
      },
    };
    return dispatch(
      updateAlertManagerConfigAction({
        newConfig,
        oldConfig: config,
        alertManagerSourceName,
        successMessage: 'Contact point deleted.',
        refetch: true,
      })
    );
  };
};

export const deleteTemplateAction = (templateName: string, alertManagerSourceName: string): ThunkResult<void> => {
  return (dispatch, getState) => {
    const config = getState().unifiedAlerting.amConfigs?.[alertManagerSourceName]?.result;
    if (!config) {
      throw new Error(`Config for ${alertManagerSourceName} not found`);
    }
    if (typeof config.template_files?.[templateName] !== 'string') {
      throw new Error(`Cannot delete template ${templateName}: not found in config.`);
    }
    const newTemplates = { ...config.template_files };
    delete newTemplates[templateName];
    const newConfig: AlertManagerCortexConfig = {
      ...config,
      alertmanager_config: {
        ...config.alertmanager_config,
        templates: config.alertmanager_config.templates?.filter((existing) => existing !== templateName),
      },
      template_files: newTemplates,
    };
    return dispatch(
      updateAlertManagerConfigAction({
        newConfig,
        oldConfig: config,
        alertManagerSourceName,
        successMessage: 'Template deleted.',
        refetch: true,
      })
    );
  };
};

export const fetchFolderAction = createAsyncThunk(
  'unifiedalerting/fetchFolder',
  (uid: string): Promise<FolderDTO> => withSerializedError((getBackendSrv() as any).getFolderByUid(uid))
);

export const fetchFolderIfNotFetchedAction = (uid: string): ThunkResult<void> => {
  return (dispatch, getState) => {
    if (!getState().unifiedAlerting.folders[uid]?.dispatched) {
      dispatch(fetchFolderAction(uid));
    }
  };
};

export const fetchAlertGroupsAction = createAsyncThunk(
  'unifiedalerting/fetchAlertGroups',
  (alertManagerSourceName: string): Promise<AlertmanagerGroup[]> => {
    return withSerializedError(fetchAlertGroups(alertManagerSourceName));
  }
);

export const checkIfLotexSupportsEditingRulesAction = createAsyncThunk<boolean, string>(
  'unifiedalerting/checkIfLotexRuleEditingSupported',
  async (rulesSourceName: string): Promise<boolean> =>
    withAppEvents(
      (async () => {
        try {
          await fetchRulerRulesGroup(rulesSourceName, 'test', 'test');
          return true;
        } catch (e) {
          if (
            (isFetchError(e) &&
              (e.data.message?.includes('GetRuleGroup unsupported in rule local store') || // "local" rule storage
                e.data.message?.includes('page not found'))) || // ruler api disabled
            e.message?.includes('404 from rules config endpoint') || // ruler api disabled
            e.data.message?.includes(RULER_NOT_SUPPORTED_MSG) // ruler api not supported
          ) {
            return false;
          }
          throw e;
        }
      })(),
      {
        errorMessage: `Failed to determine if "${rulesSourceName}" allows editing rules`,
      }
    )
);

export const deleteAlertManagerConfigAction = createAsyncThunk(
  'unifiedalerting/deleteAlertManagerConfig',
  async (alertManagerSourceName: string, thunkAPI): Promise<void> => {
    return withAppEvents(
      withSerializedError(
        (async () => {
          await deleteAlertManagerConfig(alertManagerSourceName);
          await thunkAPI.dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
        })()
      ),
      {
        errorMessage: 'Failed to reset Alertmanager configuration',
        successMessage: 'Alertmanager configuration reset.',
      }
    );
  }
);

export const deleteMuteTimingAction = (alertManagerSourceName: string, muteTimingName: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const config = getState().unifiedAlerting.amConfigs[alertManagerSourceName].result;

    const muteIntervals =
      config?.alertmanager_config?.mute_time_intervals?.filter(({ name }) => name !== muteTimingName) ?? [];

    if (config) {
      withAppEvents(
        dispatch(
          updateAlertManagerConfigAction({
            alertManagerSourceName,
            oldConfig: config,
            newConfig: {
              ...config,
              alertmanager_config: {
                ...config.alertmanager_config,
                route: config.alertmanager_config.route
                  ? removeMuteTimingFromRoute(muteTimingName, config.alertmanager_config?.route)
                  : undefined,
                mute_time_intervals: muteIntervals,
              },
            },
            refetch: true,
          })
        ),
        {
          successMessage: `Deleted "${muteTimingName}" from Alertmanager configuration`,
          errorMessage: 'Failed to delete mute timing',
        }
      );
    }
  };
};

interface TestReceiversOptions {
  alertManagerSourceName: string;
  receivers: Receiver[];
  alert?: TestReceiversAlert;
}

export const testReceiversAction = createAsyncThunk(
  'unifiedalerting/testReceivers',
  ({ alertManagerSourceName, receivers, alert }: TestReceiversOptions): Promise<void> => {
    return withAppEvents(withSerializedError(testReceivers(alertManagerSourceName, receivers, alert)), {
      errorMessage: 'Failed to send test alert.',
      successMessage: 'Test alert sent.',
    });
  }
);

interface UpdateNamespaceAndGroupOptions {
  rulesSourceName: string;
  namespaceName: string;
  groupName: string;
  newNamespaceName: string;
  newGroupName: string;
  groupInterval?: string;
}

// allows renaming namespace, renaming group and changing group interval, all in one go
export const updateLotexNamespaceAndGroupAction = createAsyncThunk(
  'unifiedalerting/updateLotexNamespaceAndGroup',
  async (options: UpdateNamespaceAndGroupOptions, thunkAPI): Promise<void> => {
    return withAppEvents(
      withSerializedError(
        (async () => {
          const { rulesSourceName, namespaceName, groupName, newNamespaceName, newGroupName, groupInterval } = options;
          if (options.rulesSourceName === GRAFANA_RULES_SOURCE_NAME) {
            throw new Error(`this action does not support Grafana rules`);
          }
          // fetch rules and perform sanity checks
          const rulesResult = await fetchRulerRules(rulesSourceName);
          if (!rulesResult[namespaceName]) {
            throw new Error(`Namespace "${namespaceName}" not found.`);
          }
          const existingGroup = rulesResult[namespaceName].find((group) => group.name === groupName);
          if (!existingGroup) {
            throw new Error(`Group "${groupName}" not found.`);
          }
          if (newGroupName !== groupName && !!rulesResult[namespaceName].find((group) => group.name === newGroupName)) {
            throw new Error(`Group "${newGroupName}" already exists.`);
          }
          if (newNamespaceName !== namespaceName && !!rulesResult[newNamespaceName]) {
            throw new Error(`Namespace "${newNamespaceName}" already exists.`);
          }
          if (
            newNamespaceName === namespaceName &&
            groupName === newGroupName &&
            groupInterval === existingGroup.interval
          ) {
            throw new Error('Nothing changed.');
          }

          // if renaming namespace - make new copies of all groups, then delete old namespace
          if (newNamespaceName !== namespaceName) {
            for (const group of rulesResult[namespaceName]) {
              await setRulerRuleGroup(
                rulesSourceName,
                newNamespaceName,
                group.name === groupName
                  ? {
                      ...group,
                      name: newGroupName,
                      interval: groupInterval,
                    }
                  : group
              );
            }
            await deleteNamespace(rulesSourceName, namespaceName);

            // if only modifying group...
          } else {
            // save updated group
            await setRulerRuleGroup(rulesSourceName, namespaceName, {
              ...existingGroup,
              name: newGroupName,
              interval: groupInterval,
            });
            // if group name was changed, delete old group
            if (newGroupName !== groupName) {
              await deleteRulerRulesGroup(rulesSourceName, namespaceName, groupName);
            }
          }

          // refetch all rules
          await thunkAPI.dispatch(fetchRulerRulesAction({ rulesSourceName }));
        })()
      ),
      {
        errorMessage: 'Failed to update namespace / group',
        successMessage: 'Update successful',
      }
    );
  }
);

export const addExternalAlertmanagersAction = createAsyncThunk(
  'unifiedAlerting/addExternalAlertmanagers',
  async (alertmanagerConfig: ExternalAlertmanagerConfig, thunkAPI): Promise<void> => {
    return withAppEvents(
      withSerializedError(
        (async () => {
          await addAlertManagers(alertmanagerConfig);
          thunkAPI.dispatch(fetchExternalAlertmanagersConfigAction());
        })()
      ),
      {
        errorMessage: 'Failed adding alertmanagers',
        successMessage: 'Alertmanagers updated',
      }
    );
  }
);

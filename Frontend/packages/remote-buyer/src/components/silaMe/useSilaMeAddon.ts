import { useEffect, useState } from "react";
import { getMyOrganizationModels } from "../../api/modelApi";
import { SILA_ME_MODEL_KEY } from "./silaMeNav";

export interface SilaMeAddon {
  /** The organization has the SILA ME add-on. False until the check finishes. */
  enabled: boolean;
  /** The model check has finished, so screens can load once instead of starting again when the answer arrives. */
  ready: boolean;
}

/** Whether the signed-in organization has the SILA ME add-on; the SILA ME menu is shown only then. */
export const useSilaMeAddon = (): SilaMeAddon => {
  const [state, setState] = useState<SilaMeAddon>({ enabled: false, ready: false });

  useEffect(() => {
    let active = true;
    getMyOrganizationModels()
      .then((result) => {
        if (!active) return;
        setState({
          enabled: Array.isArray(result) && result.some((model) => model.key === SILA_ME_MODEL_KEY),
          ready: true,
        });
      })
      .catch(() => {
        if (active) setState({ enabled: false, ready: true });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
};

import { useEffect, useState } from "react";
import { getMyOrganizationModels } from "../../api/modelApi";
import { SILA_ME_MODEL_KEY } from "./silaMeNav";

/** Whether the signed-in organization has the SILA ME add-on; the SILA ME menu is shown only then. */
export const useSilaMeAddon = (): boolean => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    getMyOrganizationModels().then((result) => {
      if (active && Array.isArray(result)) {
        setEnabled(result.some((model) => model.key === SILA_ME_MODEL_KEY));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return enabled;
};

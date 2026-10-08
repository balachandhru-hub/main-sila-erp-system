import { useEffect, useState } from "react";
import type { ContractRecord } from "../../../remote-platform-user/src/components/Contract/contractApi";
import { fetchContracts } from "../../../remote-platform-user/src/components/Contract/contractApi";
import { CONTRACT_PAGE_SIZE } from "../constants";

/** Paged contract approvals; loads only while the "contract" section is active. */
export const useContracts = (activeNav: string) => {
  const [contractRecords, setContractRecords] = useState<ContractRecord[]>([]);
  const [loadingContract, setLoadingContract] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [contractPage, setContractPage] = useState(1);
  const [selectedContract, setSelectedContract] = useState<ContractRecord | null>(null);

  useEffect(() => {
    if (activeNav !== "contract") return;
    setSelectedContract(null);
    setContractPage(1);
  }, [activeNav]);

  useEffect(() => {
    if (activeNav !== "contract") return;
    setLoadingContract(true);
    setContractError(null);
    fetchContracts((contractPage - 1) * CONTRACT_PAGE_SIZE, CONTRACT_PAGE_SIZE)
      .then(setContractRecords)
      .catch((err: any) => {
        setContractError(err.message || "Failed to load contracts.");
        setContractRecords([]);
      })
      .finally(() => setLoadingContract(false));
  }, [activeNav, contractPage]);

  return {
    contractRecords,
    loadingContract,
    contractError,
    contractPage,
    setContractPage,
    selectedContract,
    setSelectedContract,
  };
};

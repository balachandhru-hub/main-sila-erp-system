import { useEffect, useState } from "react";
import { getBuyerProfile, fetchBuyerRFQs } from "../api/Buyerapi";
import { useAuth } from "../../../host-app/src/AuthContext.tsx";
import { RFQ_INITIAL_VISIBLE } from "../constants";

/** Resolves the buyer id and loads the RFQs shown in the dashboard's "Recent RFQs" panel. */
export const useBuyerRfqs = () => {
  const { auth } = useAuth();
  const [buyerId, setBuyerId] = useState<string | null>(auth?.buyerId ?? null);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loadingRfqs, setLoadingRfqs] = useState(false);
  const [rfqsError, setRfqsError] = useState<string | null>(null);
  const [visibleRfqCount, setVisibleRfqCount] = useState(RFQ_INITIAL_VISIBLE);

  useEffect(() => {
    if (auth?.buyerId) {
      setBuyerId(auth.buyerId);
    }
  }, [auth?.buyerId]);

  useEffect(() => {
    const loadBuyerProfile = async () => {
      if (!buyerId) {
        try {
          const profile = await getBuyerProfile();
          if (profile?.id) {
            setBuyerId(profile.id);
          } else {
            setRfqsError("Buyer profile not found. Please complete onboarding.");
          }
        } catch (err: any) {
          setRfqsError("Failed to load buyer profile details.");
        }
      }
    };
    loadBuyerProfile();
  }, [buyerId]);

  const loadRfqs = async () => {
    if (!buyerId) return;
    setLoadingRfqs(true);
    setRfqsError(null);
    try {
      const data = await fetchBuyerRFQs({
        buyerId,
        index: 0,
        limit: RFQ_INITIAL_VISIBLE,
      });
      if (data.length > 0) {
        setRfqs(data);
        setVisibleRfqCount(Math.min(RFQ_INITIAL_VISIBLE, data.length));
      } else {
        setRfqs([]);
        setVisibleRfqCount(0);
      }
    } catch (err: any) {
      setRfqsError(err.message || "Failed to load sourcing opportunities.");
    } finally {
      setLoadingRfqs(false);
    }
  };

  useEffect(() => {
    loadRfqs();
  }, [buyerId]);

  return { buyerId, rfqs, loadingRfqs, rfqsError, visibleRfqCount, loadRfqs };
};

using Buyer.Domain.Common;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// SAP stock-count adjustment sent through the existing UPDATE_STOCK configuration (FIVE_POS_UPDATE when that
    /// API is active). Shortage is Z02, surplus is Z01, and the quantity is always a positive absolute value.
    /// </summary>
    public static class SilaStockCountSap
    {
        public const string API_CONFIG_NAME = "FIVE_POS_UPDATE";
        public const string GOODS_MOVEMENT_CODE = "03";
        public const string SURPLUS_TYPE = "Z01";
        public const string SHORTAGE_TYPE = "Z02";

        public static bool IsStockCount(string? movementType)
        {
            return movementType == Common.SILA_MOVEMENT_STOCK_COUNT;
        }

        /// <summary>Z01 adds stock (surplus). Z02 removes stock (shortage). Never a negative quantity.</summary>
        public static string GoodsMovementType(string? direction)
        {
            return direction == Common.SILA_DIRECTION_IN ? SURPLUS_TYPE : SHORTAGE_TYPE;
        }

        public static decimal AbsoluteQuantity(decimal quantity)
        {
            return Math.Abs(quantity);
        }
    }
}

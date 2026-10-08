namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Outcome of one run of the ERP posting job.
    /// </summary>
    public class SilaErpPostingRunResultDto
    {
        public int Processed { get; set; }
        public int Posted { get; set; }
        public int Failed { get; set; }
        public int Retrying { get; set; }
        public int Skipped { get; set; }
    }
}

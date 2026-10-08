using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.UploadSilaPosSales
{
    /// <summary>
    /// Step 1 of the upload: reads the sales file (template columns BusinessDate, TransactionId, LineId, PosCode, Qty, UOM,
    /// OutletCode, Currency, Amount; Quantity and OutletId are accepted aliases), validates every row (format, duplicates,
    /// unmapped POS codes, invalid outlets, UOM, recipe readiness) and stores the new lines as RECEIVED in a PREVIEW batch.
    /// Nothing is deducted until the batch is processed.
    /// </summary>
    public class UploadSilaPosSalesCommandHandler : IRequestHandler<UploadSilaPosSalesCommand, SilaPosPreviewDto>
    {
        private const int MAX_ROWS = 20000;
        private const int MAX_PREVIEW_ROWS = 500;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public UploadSilaPosSalesCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<SilaPosPreviewDto> Handle(UploadSilaPosSalesCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunForJobAsync(_repository, _logger, nameof(UploadSilaPosSalesCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<SilaPosPreviewDto> HandleOnceAsync(UploadSilaPosSalesCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Previewing POS sales. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, PosSourceId: {request.PosSourceId}, FileName: {request.FileName}, Bytes: {request.Content.Length}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSource? source = await SilaPosSources.ResolveAsync(_repository, _logger, buyer.Id, request.PosSourceId, SilaPosSources.KIND_FILE, cancellationToken);
            List<List<string>> table = SilaPosFiles.ReadTable(request.Content, request.FileName, _logger, true);
            if (table.Count < 2)
            {
                _logger.LogError($"POS sales file has no lines. FileName: {request.FileName}");
                throw new BadRequestCustomException("The file has no sales lines.", "Put the column names in the first row and one sold line per row below it.");
            }

            if (table.Count - 1 > MAX_ROWS)
            {
                _logger.LogError($"POS sales file too large. Rows: {table.Count - 1}");
                throw new BadRequestCustomException("The file has too many lines.", $"Upload at most {MAX_ROWS} lines per file.");
            }

            Dictionary<string, int> columns = SilaPosFiles.HeaderMap(table[0]);
            bool hasColumns = columns.ContainsKey("BUSINESSDATE") && columns.ContainsKey("TRANSACTIONID") && columns.ContainsKey("POSCODE")
                && (columns.ContainsKey("QTY") || columns.ContainsKey("QUANTITY"))
                && (columns.ContainsKey("OUTLETCODE") || columns.ContainsKey("OUTLETID"));
            if (!hasColumns)
            {
                _logger.LogError("POS sales file misses columns.");
                throw new BadRequestCustomException(
                    "Columns are missing.",
                    "Use the template: the first row must name BusinessDate, TransactionId, LineId, PosCode, Qty, UOM, OutletCode, Currency, Amount.");
            }

            List<SilaPosRawRow> raws = new List<SilaPosRawRow>();
            for (int index = 1; index < table.Count; index++)
            {
                List<string> cells = table[index];
                if (cells.All(string.IsNullOrWhiteSpace))
                {
                    continue;
                }

                raws.Add(new SilaPosRawRow
                {
                    RowNumber = index + 1,
                    BusinessDate = SilaPosFiles.Cell(cells, columns, "BUSINESSDATE"),
                    TransactionId = SilaPosFiles.Cell(cells, columns, "TRANSACTIONID"),
                    LineId = SilaPosFiles.Cell(cells, columns, "LINEID"),
                    PosCode = SilaPosFiles.Cell(cells, columns, "POSCODE"),
                    Quantity = SilaPosFiles.Cell(cells, columns, "QTY", "QUANTITY"),
                    Uom = SilaPosFiles.Cell(cells, columns, "UOM"),
                    OutletCode = SilaPosFiles.Cell(cells, columns, "OUTLETCODE", "OUTLETID"),
                    Currency = SilaPosFiles.Cell(cells, columns, "CURRENCY"),
                    Amount = SilaPosFiles.Cell(cells, columns, "AMOUNT")
                });
            }

            List<SilaPosRowErrorDto> errors = new List<SilaPosRowErrorDto>();
            Dictionary<int, string> invalid = new Dictionary<int, string>();
            List<SilaPosSaleRowDto> rows = new List<SilaPosSaleRowDto>();
            foreach (SilaPosRawRow raw in raws)
            {
                SilaPosSaleRowDto? row = SilaPosRows.Read(raw, errors, out string? message);
                if (row == null)
                {
                    invalid[raw.RowNumber] = message ?? "The line is not valid.";
                    continue;
                }

                rows.Add(row);
            }

            SilaPosReceipt receipt = await SilaPosProcessing.ReceiveAsync(
                _repository, buyer.Id, request.UserId, Common.SILA_POS_SOURCE_FILE, source?.Id, Path.GetFileName(request.FileName),
                Common.SILA_POS_BATCH_PREVIEW, rows, raws.Count, invalid.Count, cancellationToken);
            SilaPosMatching matching = await SilaPosMatching.LoadAsync(
                _repository, buyer.Id, source == null ? new List<Guid>() : new List<Guid> { source.Id }, cancellationToken);

            SilaPosPreviewDto result = new SilaPosPreviewDto
            {
                BatchId = receipt.Batch.Id,
                BatchNumber = receipt.Batch.BatchNumber,
                FileName = receipt.Batch.FileName ?? string.Empty,
                PosSourceId = source?.Id,
                PosSourceName = source?.Name,
                TotalRows = raws.Count,
                InvalidRows = invalid.Count,
                DuplicateRows = receipt.DuplicateRows.Count,
                ValidRows = receipt.Transactions.Count
            };

            List<SilaPosPreviewRowDto> problems = new List<SilaPosPreviewRowDto>();
            List<SilaPosPreviewRowDto> ready = new List<SilaPosPreviewRowDto>();
            foreach (SilaPosRawRow raw in raws)
            {
                SilaPosPreviewRowDto preview = ToPreview(raw);
                if (invalid.TryGetValue(raw.RowNumber, out string? invalidMessage))
                {
                    preview.Status = SilaPosMatching.ROW_INVALID;
                    preview.Message = invalidMessage;
                }
                else if (receipt.DuplicateRows.Contains(raw.RowNumber))
                {
                    preview.Status = SilaPosMatching.ROW_DUPLICATE;
                    preview.Message = "This transaction line was already received; it is skipped.";
                }
                else if (receipt.ByRow.TryGetValue(raw.RowNumber, out PosSalesTransaction? line))
                {
                    SilaPosMatch match = matching.Match(source?.Id, line.OutletCode, line.PosCode, line.Uom);
                    preview.Status = match.Status;
                    preview.Message = match.Message;
                    preview.OutletLocationName = match.Outlet?.LocationName;
                    preview.RecipeCode = match.Recipe?.RecipeCode;
                    Count(result, match.Status);
                }

                (preview.Status == SilaPosMatching.ROW_READY ? ready : problems).Add(preview);
            }

            List<SilaPosPreviewRowDto> shown = problems.Take(MAX_PREVIEW_ROWS).ToList();
            shown.AddRange(ready.Take(MAX_PREVIEW_ROWS - shown.Count));
            result.Rows = shown.OrderBy(x => x.RowNumber).ToList();
            result.RowsTruncated = problems.Count + ready.Count > shown.Count;
            await _repository.SaveAsync();

            _logger.LogInfo(
                $"POS sales previewed. BatchNumber: {result.BatchNumber}, Rows: {result.TotalRows}, Valid: {result.ValidRows}, Ready: {result.ReadyToProcess}, Invalid: {result.InvalidRows}, Duplicates: {result.DuplicateRows}");
            return result;
        }

        private static void Count(SilaPosPreviewDto result, string status)
        {
            switch (status)
            {
                case SilaPosMatching.ROW_READY: result.ReadyToProcess++; break;
                case SilaPosMatching.ROW_UNMAPPED_POS_CODE: result.UnmappedPosCodes++; break;
                case SilaPosMatching.ROW_INVALID_OUTLET: result.InvalidOutlets++; break;
                case SilaPosMatching.ROW_INVALID_UOM: result.InvalidUom++; break;
                default: result.RecipeNotReady++; break;
            }
        }

        private static SilaPosPreviewRowDto ToPreview(SilaPosRawRow raw)
        {
            return new SilaPosPreviewRowDto
            {
                RowNumber = raw.RowNumber,
                BusinessDate = raw.BusinessDate,
                TransactionId = raw.TransactionId,
                LineId = raw.LineId,
                PosCode = raw.PosCode,
                Quantity = raw.Quantity,
                Uom = raw.Uom,
                OutletCode = raw.OutletCode,
                Currency = raw.Currency,
                Amount = raw.Amount
            };
        }
    }
}

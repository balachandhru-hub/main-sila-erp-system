using Buyer.Infrastructure.DbContext;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(RepositoryContext))]
    [Migration("20261017223000_InvoicePostingData")]
    public partial class InvoicePostingData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "posting_data",
                schema: "buyersystem",
                table: "invoice",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "posting_data",
                schema: "buyersystem",
                table: "invoice");
        }
    }
}

using Buyer.Infrastructure.DbContext;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    [DbContext(typeof(RepositoryContext))]
    [Migration("20261023020000_OperationalTaskAlert")]
    public partial class OperationalTaskAlert : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "operational_task",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    task_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    source_module = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    source_document_type = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    source_document_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    source_document_number = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    priority = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    assigned_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    assigned_permission = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    due_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    completed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    completed_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    action_type = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    action_route = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    deduplication_key = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    purchase_order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    goods_receipt_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    invoice_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    credit_memo_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    metadata = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_operational_task", x => x.id);
                    table.ForeignKey(
                        name: "fk_operational_task_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "operational_alert",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    alert_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    source_module = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    source_document_type = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    source_document_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    severity = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    message = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    recipient_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    recipient_permission = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    acknowledged_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    acknowledged_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    deduplication_key = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    action_route = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    purchase_order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    goods_receipt_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    invoice_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    credit_memo_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    metadata = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_operational_alert", x => x.id);
                    table.ForeignKey(
                        name: "fk_operational_alert_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_operational_task_buyer_id_deduplication_key",
                schema: "buyersystem",
                table: "operational_task",
                columns: new[] { "buyer_id", "deduplication_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_operational_task_buyer_id_status",
                schema: "buyersystem",
                table: "operational_task",
                columns: new[] { "buyer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_operational_alert_buyer_id_deduplication_key",
                schema: "buyersystem",
                table: "operational_alert",
                columns: new[] { "buyer_id", "deduplication_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_operational_alert_buyer_id_status",
                schema: "buyersystem",
                table: "operational_alert",
                columns: new[] { "buyer_id", "status" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "operational_task", schema: "buyersystem");
            migrationBuilder.DropTable(name: "operational_alert", schema: "buyersystem");
        }
    }
}

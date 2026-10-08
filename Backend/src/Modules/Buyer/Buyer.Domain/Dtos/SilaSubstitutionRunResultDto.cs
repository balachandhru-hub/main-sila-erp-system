namespace Buyer.Domain.Dtos
{
    /// <summary>Outcome of a substitution check run.</summary>
    public class SilaSubstitutionRunResultDto
    {
        public int Buyers { get; set; }
        public int RecipesChecked { get; set; }
        public int ShortIngredients { get; set; }
        public int Created { get; set; }
        public int Updated { get; set; }
        public int AutoDismissed { get; set; }
    }
}

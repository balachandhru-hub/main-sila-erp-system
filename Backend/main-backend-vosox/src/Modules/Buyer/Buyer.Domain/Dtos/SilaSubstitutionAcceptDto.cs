namespace Buyer.Domain.Dtos
{
    /// <summary>The replacements chosen in the review; each substitute must be a candidate for its ingredient.</summary>
    public class SilaSubstitutionAcceptDto
    {
        public List<SilaSubstitutionReplacementDto> Replacements { get; set; } = new();
    }
}

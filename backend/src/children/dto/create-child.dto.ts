import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, Min, ValidateNested } from 'class-validator';

class ConsentDto {
  @IsString()
  @IsNotEmpty()
  consentVersion: string;

  @IsString()
  @IsNotEmpty()
  verificationMethod: string; // authenticated_parent | institution_paper | mobile_verification
}

export class CreateChildDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  birthYear: number;

  @ValidateNested()
  @Type(() => ConsentDto)
  consent: ConsentDto;
}

import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

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
  @MaxLength(10) // 이름·별명 10자 제한 — 화면 레이아웃·대사 호명 길이 보호
  name: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  birthYear: number;

  @ValidateNested()
  @Type(() => ConsentDto)
  consent: ConsentDto;
}

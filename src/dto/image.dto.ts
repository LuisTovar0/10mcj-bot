import FileDto from "./file.dto";

export default interface ImageDto {
  domainId: string;
  offset?: number;
  format: string;
  file: FileDto;
}

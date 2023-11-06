import FileDto from "../dto/file.dto";
import FileDataModel from "../persistence/data-model/file.data-model";

export function dataModelToDto({domainId, id, file}: FileDataModel): FileDto {
  return {domainId, id, file};
}


export function dtoToDataModel({domainId, file, id}: FileDto): FileDataModel {
  return {domainId, id, file};
}

import * as fileMapper from './file.mapper';
import ImageDto from "../dto/image.dto";
import ImageDataModel from "../persistence/dataModel/image.data-model";
import FileDataModel from "../persistence/dataModel/file.data-model";

export function dataModelToDto(img: ImageDataModel, file: FileDataModel): ImageDto {
  return {
    domainId: img.domainId,
    offset: img.offset,
    // format: img.format,
    file: fileMapper.dataModelToDto(file)
  };
}

export function dtoToDataModel(dto: ImageDto): { img: ImageDataModel, file: FileDataModel } {
  const img: ImageDataModel = {
    domainId: dto.domainId,
    offset: dto.offset,
    // format: dto.format,
    fileDomainId: dto.file.domainId
  };
  const file = fileMapper.dtoToDataModel(dto.file);
  return {img, file};
}
